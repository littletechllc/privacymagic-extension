import psl from 'psl';

export const registrableDomainFromUrl = (url: string): string | null =>
  psl.get(new URL(url).hostname);

export const logError = (error: unknown, message: string, details?: {} | undefined) => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  console.error('Error:', `'${message}'`, `'${errorObj.name}'`, `'${errorObj.message}'`, details, errorObj.stack);
};

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

export const entries = <K extends string, V>(obj: Record<K, V>): [K, V][] => {
  return Object.entries(obj) as [K, V][];
};
