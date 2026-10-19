/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  const globals = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis))
  return {
    SharedStorage: 'SharedStorage' in globals,
    SharedStorageAppendMethod: 'SharedStorageAppendMethod' in globals,
    SharedStorageClearMethod: 'SharedStorageClearMethod' in globals,
    SharedStorageDeleteMethod: 'SharedStorageDeleteMethod' in globals,
    SharedStorageModifierMethod: 'SharedStorageModifierMethod' in globals,
    SharedStorageSetMethod: 'SharedStorageSetMethod' in globals,
    SharedStorageWorklet: 'SharedStorageWorklet' in globals,
    sharedStorage: 'sharedStorage' in globals
  }
}
