import psl from '../../thirdparty/psl.mjs';

export const registrableDomainFromUrl = (url) =>
  psl.get(new URL(url).hostname);

export const logError = (error, message, details) => {
  console.error('Error:', `'${message}'`, `'${error.name}'`, `'${error.message}'`, details, error.stack);
};

const dnrIdManager = {
  keyToIdInteger: {},
  // this is a global counter for the DNR IDs >= 1.
  idCounter: 0,
  getIntegerForKey (key) {
    const existingInteger = this.keyToIdInteger[key];
    if (existingInteger === undefined) {
      this.idCounter++;
      const newInteger = this.idCounter;
      this.keyToIdInteger[key] = newInteger;
      return newInteger;
    }
    return existingInteger;
  }
};

export const getDnrIdForKey = (key) => {
  return dnrIdManager.getIntegerForKey(key);
};

export const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

export const SUBRESOURCE_RULE_PREFIX = 'subresource';
export const TOP_LEVEL_RULE_PREFIX = 'top-level';

// Add an item to an array if it is not present.
export const addIfMissing = (array, item) => {
  if (!array.includes(item)) {
    array.push(item);
  }
};

// Remove an item from an array if it is present.
export const removeIfPresent = (array, item) => {
  const index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
  }
};
