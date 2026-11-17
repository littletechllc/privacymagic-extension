function runProbe () {
  const nav = /** @type {Navigator & { deviceMemory?: number }} */ (navigator)
  const present = 'deviceMemory' in nav
  const value = nav.deviceMemory
  // Use null when absent so JSON.stringify keeps the key (undefined is dropped).
  const jsHeapSizeLimit = performance.memory?.jsHeapSizeLimit ?? null
  return {
    present,
    deviceMemory: value === undefined ? 'undefined' : value,
    jsHeapSizeLimit
  }
}
