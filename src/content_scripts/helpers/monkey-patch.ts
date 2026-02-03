// Type for methods of an object (union of all methods).
type MethodOf<TThis> = {
  [K in keyof TThis]: TThis[K] extends (...args: unknown[]) => unknown ? TThis[K] : never
}[keyof TThis]

type MethodOfKey<T, K extends keyof T> = T[K] extends (...args: infer Args) => infer Return
  ? (...args: Args) => Return
  : never

// Type for method keys of an object.
type MethodKey<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T]: T[P] extends (...args: any[]) => any ? P : never
}[keyof T]

// Type for keys that are NOT methods (could be getters or value properties)
type NonMethodPropertyKey<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T]: T[P] extends (...args: any[]) => any ? never : P
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
export const createSafeGetter = <T, K extends NonMethodPropertyKey<T>>(
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

export const createSafeSetter = <T, K extends NonMethodPropertyKey<T>>(
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

export const redefinePropertyValues = <T>(obj: T, propertyMap: { [key: string]: unknown }): void => {
  const originalProperties: PropertyDescriptorMap = {}
  const newProperties: PropertyDescriptorMap = {}
  for (const [prop, value] of Object.entries(propertyMap)) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(obj, prop)
    originalProperties[prop] = originalDescriptor != null ? originalDescriptor : nonProperty
    if (value === undefined) {
      newProperties[prop] = nonProperty
    } else {
      if (originalDescriptor == null) {
        newProperties[prop] = { configurable: true, get: () => value, set: () => { /* do nothing */ } }
      } else if (originalDescriptor.value !== undefined) {
        newProperties[prop] = { ...originalDescriptor, value }
      } else {
        newProperties[prop] = { ...originalDescriptor, get: () => value, set: () => { /* do nothing */ } }
      }
    }
  }
  objectDefinePropertiesSafe(obj, newProperties)
}

