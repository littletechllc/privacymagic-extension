import psl from 'psl';

/** @type {(url: string) => string | null} */
export const registrableDomainFromUrl = (url) =>
  psl.get(new URL(url).hostname);

export const logError = (error, message, details?: {} | undefined) => {
  console.error('Error:', `'${message}'`, `'${error.name}'`, `'${error.message}'`, details, error.stack);
};

export const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

/* Add an item to an array if it is not present.
 ** @type {<T>(array: T[], item: T) => void} */
export const addIfMissing = (array, item) => {
  if (!array.includes(item)) {
    array.push(item);
  }
};

/* Remove an item from an array if it is present.
 ** @type {<T>(array: T[], item: T) => void} */
export const removeIfPresent = (array, item) => {
  const index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
  }
};
