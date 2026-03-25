import { getNavigatorConstructor, GlobalScope } from "./globalObject"
import { objectGetEntriesSafe } from "./helpers"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any

// Keys of T whose values are functions.
type MethodKey<T> = { [P in keyof T]: T[P] extends AnyFunction ? P : never }[keyof T]

// Type for methods of an object
export type MethodOf<T> = T[MethodKey<T>] & AnyFunction

// Type of method of specific key
type MethodOfKey<T, K extends keyof T> = T[K] extends (...args: infer Args) => infer Return
  ? (...args: Args) => Return
  : never

// Keys of T whose values are not functions (could be getters or value properties)
type FieldKey<T> = {
  [P in keyof T]: T[P] extends AnyFunction ? never : P
}[keyof T]

// Safe version of Reflect.apply; can be called even after site scripts have
// overwritten Reflect.apply. Also enforces type safety more than the original
// Reflect.apply.
export const reflectApplySafe = Reflect.apply as <
  TThis,
  TMethod extends MethodOf<TThis>,
>(
  method: TMethod,
  thisArg: TThis,
  args: Parameters<TMethod>
) => ReturnType<TMethod>

// Safe version of Object.defineProperties; can be called even after site scripts have
// overwritten Object.defineProperties.
export const objectDefinePropertiesSafe = Object.defineProperties

// Safe version of Object.getOwnPropertyDescriptors; can be called even after site scripts have
// overwritten Object.getOwnPropertyDescriptors.
export const objectGetOwnPropertyDescriptorsSafe = Object.getOwnPropertyDescriptors

export const objectGetOwnPropertyDescriptorSafe = Object.getOwnPropertyDescriptor

// Create a safe method that can be called even after site scripts have
// overwritten the method. Compile-time check that the methodName points to a
// method of the constructor function.
export const createSafeMethod = <T, K extends MethodKey<T>>(
  constructorFunction: { prototype: T },
  methodName: K,
) => {
  const method = constructorFunction.prototype[methodName]
  return <TInstance extends T>(
    instance: TInstance,
    ...args: Parameters<MethodOfKey<TInstance, K>>
  ): ReturnType<MethodOfKey<TInstance, K>> =>
    (reflectApplySafe(method as MethodOf<TInstance>,
                      instance,
                      args as Parameters<MethodOf<TInstance>>) as ReturnType<MethodOfKey<TInstance, K>>)
}

// Create a safe getter that can be called even after site scripts have
// overwritten the getter. Compile-time check that the propertyName points to a
// getter of the object.
export const createSafeGetter = <T, K extends FieldKey<T>>(
  object: { prototype: T },
  propertyName: K,
) => {
  const descriptor = objectGetOwnPropertyDescriptorSafe(object.prototype, propertyName)
  if (descriptor === undefined) {
    throw new Error(`Property ${String(propertyName)} not found`)
  }
  if (descriptor.get === undefined) {
    throw new Error(`Getter for property ${String(propertyName)} not found`)
  }
  // Ensure it's an accessor property, not a data property
  if ('value' in descriptor && descriptor.value !== undefined) {
    throw new Error(`Property ${String(propertyName)} is a data property, not a getter`)
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const getter = descriptor.get as MethodOf<T>
  return (instance: T): T[K] => {
    return reflectApplySafe(getter, instance, [] as unknown as Parameters<MethodOf<T>>) as T[K]
  }
}

export const createSafeSetter = <T, K extends FieldKey<T>>(
  object: { prototype: T },
  propertyName: K,
) => {
  const descriptor = objectGetOwnPropertyDescriptorSafe(object.prototype, propertyName)
  if (descriptor === undefined) {
    throw new Error(`Property ${String(propertyName)} not found`)
  }
  if (descriptor.set === undefined) {
    throw new Error(`Setter for property ${String(propertyName)} not found`)
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = descriptor.set as MethodOf<T>
  return (instance: T, value: T[K]): void => {
    reflectApplySafe(setter, instance, [value] as unknown as Parameters<MethodOf<T>>)
  }
}

export const nonProperty: PropertyDescriptor = { get: undefined, set: undefined, configurable: true }

/**
 * Redefine fields of an object.
 * @param obj - The object to redefine fields of (usually an object's prototype).
 * @param fieldMap - A map of field names to new field values. Each new field value
 * must be a value that can be assigned to the field.
 */
export const redefineFields = <T, K extends FieldKey<T>>(obj: T, fieldMap: Partial<Record<K, T[K]>>): void => {
  const newFields: PropertyDescriptorMap = {}
  for (const [fieldName, newFieldValue] of objectGetEntriesSafe(fieldMap)) {
    const originalDescriptor = objectGetOwnPropertyDescriptorSafe(obj, fieldName)
    // Do not treat `undefined` as missing: callers may set a data property to `undefined` (e.g. `navigator.keyboard`).
    if (originalDescriptor == null) {
      throw new Error(`Property ${String(fieldName)} is not a field`)
    }
    if (originalDescriptor.get != null) {
      // Accessor property: set to a getter that returns the new value.
      newFields[fieldName] = { ...originalDescriptor, get: () => newFieldValue, set: () => { /* do nothing */ } }
    } else {
      // Data property: set to the new value.
      newFields[fieldName] = { ...originalDescriptor, value: newFieldValue }
    }
  }
  objectDefinePropertiesSafe(obj, newFields)
}

/**
 * Original implementation of Function.prototype.toString.
 */
const originalToString = createSafeMethod(Function, 'toString')

/**
 * Like `Object.getOwnPropertyDescriptor`, but also searches `[[Prototype]]` so inherited
 * own data properties (e.g. `EventTarget.prototype.addEventListener` on a subclass prototype) resolve.
 */
const getOwnPropertyDescriptorInPrototypeChain = (obj: object, key: PropertyKey): PropertyDescriptor | undefined => {
  let current: object | null = obj
  while (current != null) {
    const d = objectGetOwnPropertyDescriptorSafe(current, key)
    if (d !== undefined) {
      return d
    }
    current = Object.getPrototypeOf(current) as object | null
  }
  return undefined
}

/**
 * Redefine methods of an object.
 * @param obj - The object to redefine methods of (usually an object's prototype).
 * @param newMethodMap - A map of method names to new methods. Each new method
 * must be a function that takes the same arguments as the original method.
 */
export const redefineMethods = <T, K extends MethodKey<T>>(obj: T, newMethodMap: Partial<Record<K, MethodOf<T>>>): void => {
  const newMethods: PropertyDescriptorMap = {}
  for (const [methodName, method] of objectGetEntriesSafe(newMethodMap)) {
    if (method == null) {
      throw new Error(`Definition for new method ${String(methodName)} is undefined`)
    }
    const originalDescriptor = getOwnPropertyDescriptorInPrototypeChain(obj as object, methodName)
    const originalMethod = originalDescriptor?.value as MethodOf<T> | undefined
    if (originalDescriptor == null || originalMethod == null || typeof originalMethod !== 'function') {
      throw new Error(`Original method ${String(methodName)} not found`)
    }
    // Override the method's toString to return the original toString implementation.
    // This is to prevent the method from being detected as monkey-patched.
    method.toString = () => originalToString(originalMethod as AnyFunction)
    newMethods[methodName] = { ...originalDescriptor, value: method }
  }
  objectDefinePropertiesSafe(obj, newMethods)
}

export const redefineNavigatorFields = <T, K extends FieldKey<T>>(globalObject: GlobalScope, propertyMap: Partial<Record<K, T[K]>>): void => {
  const NavigatorConstructor = getNavigatorConstructor(globalObject)
  redefineFields(NavigatorConstructor.prototype, propertyMap)
}

