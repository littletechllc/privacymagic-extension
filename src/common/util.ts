import psl from 'psl';

export const registrableDomainFromUrl = (url: string): string | null =>
  psl.get(new URL(url).hostname);

export const logError = (error, message, details?: {} | undefined) => {
  console.error('Error:', `'${message}'`, `'${error.name}'`, `'${error.message}'`, details, error.stack);
};

export const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

// Add an item to an array if it is not present.
export const addIfMissing = <T>(array: T[], item: T): void => {
  if (!array.includes(item)) {
    array.push(item);
  }
};

// Remove an item from an array if it is present.
export const removeIfPresent = <T>(array: T[], item: T): void => {
  const index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
  }
};
