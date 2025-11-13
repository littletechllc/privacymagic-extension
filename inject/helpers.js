const reflectApply = (...args) => Reflect.apply(...args);

export const reflectApplySafe = (func, thisArg, args) => {
  try {
    return reflectApply(func, thisArg, args);
  } catch (error) {
    return undefined;
  }
};

export const definePropertiesSafe = (...args) => Object.defineProperties(...args);

export const nonProperty = { get: undefined, set: undefined, configurable: true };

export const redefinePropertyValues = (obj, propertyMap) => {
  const originalProperties = {};
  const newProperties = {};
  for (const [prop, value] of Object.entries(propertyMap)) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(obj, prop);
    originalProperties[prop] = originalDescriptor || nonProperty;
    if (value === undefined) {
      newProperties[prop] = nonProperty;
    } else {
      if (!originalDescriptor) {
        newProperties[prop] = { configurable: true, get: () => value };
      } else if (originalDescriptor.value) {
        newProperties[prop] = { ...originalDescriptor, value };
      } else {
        newProperties[prop] = { ...originalDescriptor, get: () => value };
      }
    }
  }
  Object.defineProperties(obj, newProperties);
  return () => {
    definePropertiesSafe(obj, originalProperties);
  };
};

const weakMapGet = Object.getOwnPropertyDescriptor(WeakMap.prototype, 'get').value;
const weakMapHas = Object.getOwnPropertyDescriptor(WeakMap.prototype, 'has').value;
const weakMapSet = Object.getOwnPropertyDescriptor(WeakMap.prototype, 'set').value;
export const weakMapGetSafe = (weakMap, key) => reflectApplySafe(weakMapGet, weakMap, [key]);
export const weakMapHasSafe = (weakMap, key) => reflectApplySafe(weakMapHas, weakMap, [key]);
export const weakMapSetSafe = (weakMap, key, value) => reflectApplySafe(weakMapSet, weakMap, [key, value]);

export const reflectConstructSafe = Reflect.construct;