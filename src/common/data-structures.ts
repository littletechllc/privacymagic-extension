/**
 * Add an item to an array if it is not present.
 * @param array - The array to add to, or undefined if the array doesn't exist yet.
 * @param item - The item to add to the array.
 * @returns A new array with the item added if it wasn't already present. Never returns undefined.
 * @template T - The type of items in the array.
 */
const addIfMissing = <T>(array: T[] | undefined, item: T): T[] => {
  const newArray = (array === undefined) ? [] : [...array]
  if (!newArray.includes(item)) {
    newArray.push(item)
  }
  return newArray
}

/**
 * Remove an item from an array if it is present.
 * @param array - The array to remove from, or undefined if the array doesn't exist.
 * @param item - The item to remove from the array.
 * @returns A new array with the item removed, or undefined if the array is empty or the item wasn't found.
 * @template T - The type of items in the array.
 */
const removeIfPresent = <T>(array: T[] | undefined, item: T): T[] | undefined => {
  if (array === undefined) {
    return undefined
  }
  const newArray = array.filter(i => i !== item)
  return newArray.length === 0 ? undefined : newArray
}

/**
 * Update a list by conditionally including or excluding an item.
 * If include is true, the item is added to the array (if not already present).
 * If include is false, the item is removed from the array (if present).
 * @param array - The array to update, or undefined if the array doesn't exist yet.
 * @param item - The item to add or remove.
 * @param include - Whether to include the item (true) or exclude it (false).
 * @returns The updated array, or undefined if the array is empty after the operation.
 * @template T - The type of items in the array.
 */
export const includeInListIfNeeded = <T>(array: T[] | undefined, item: T, include: boolean): T[] | undefined =>
  include ? addIfMissing<T>(array, item) : removeIfPresent<T>(array, item)

/**
 * Get the entries of an object as a typed array of key-value pairs.
 * This is a type-safe wrapper around Object.entries().
 * @param obj - The object to get entries from.
 * @returns An array of [key, value] tuples.
 * @template K - The type of the object keys (must extend string).
 * @template V - The type of the object values.
 */
export const objectEntries = <K extends string, V>(obj: Record<K, V>): Array<[K, V]> =>
  Object.entries(obj) as Array<[K, V]>
