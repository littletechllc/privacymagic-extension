function runProbe () {
  const nav = /** @type {Navigator & { deviceMemory?: number }} */ (navigator)
  const present = 'deviceMemory' in nav
  const value = nav.deviceMemory
  return {
    present,
    deviceMemory: value === undefined ? 'undefined' : value
  }
}
