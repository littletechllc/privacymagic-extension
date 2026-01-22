import psl from 'psl'

export const registrableDomainFromUrl = (url: string): string | null =>
  psl.get(new URL(url).hostname)

export const logError = (error: unknown, message: string, details?: unknown): void => {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  console.error('Error:', `'${message}'`, `'${errorObj.name}'`, `'${errorObj.message}'`, details, errorObj.stack)
}

// Add an item to an array if it is not present. Return undefined if the array is empty.
const addIfMissing = <T>(array: T[] | undefined, item: T): T[] => {
  const newArray = (array === undefined) ? [] : [...array]
  if (!newArray.includes(item)) {
    newArray.push(item)
  }
  return newArray
}

// Remove an item from an array if it is present. Return undefined if the array is empty.
const removeIfPresent = <T>(array: T[] | undefined, item: T): T[] | undefined => {
  if (array === undefined) {
    return undefined
  }
  const newArray = array.filter(i => i !== item)
  return newArray.length === 0 ? undefined : newArray
}

/**
 * Update a list of exceptions. If the item is exceptional, it is added to the array.
 * If the item is unexceptional, it is removed from the array.
 * @param array - The array to update.
 * @param item - The item to add or remove.
 * @param unexceptional - Whether the item is unexceptional or not.
 * @returns The updated array.
 */
export const updateListOfExceptions = <T>(array: T[] | undefined, item: T, unexceptional: boolean): T[] | undefined =>
  (unexceptional === false) ? addIfMissing<T>(array, item) : removeIfPresent<T>(array, item)

export const entries = <K extends string, V>(obj: Record<K, V>): Array<[K, V]> => {
  return Object.entries(obj) as Array<[K, V]>
}

// Safely call async functions in event listeners.
export const handleAsync = (fn: () => Promise<void>, onError?: (error: unknown) => void): void => {
  void fn().catch((error) => {
    if (onError !== undefined) {
      onError(error)
    } else {
      logError(error, 'error in async event handler')
    }
  })
}

export const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] =
  Object.values(chrome.declarativeNetRequest.ResourceType)
