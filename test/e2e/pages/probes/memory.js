function runProbe () {
  const nav = /** @type {Navigator & { deviceMemory?: number }} */ (navigator)
  const present = 'deviceMemory' in nav
  const value = nav.deviceMemory
  const jsHeapSizeLimit = performance.memory?.jsHeapSizeLimit
  return {
    present,
    deviceMemory: value === undefined ? 'undefined' : value,
    jsHeapSizeLimit
  }
}
