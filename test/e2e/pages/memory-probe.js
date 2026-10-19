/**
 * Read navigator.deviceMemory the way a page, dedicated worker, or shared worker would.
 * `undefined` is encoded as the string "undefined" so the result survives JSON.
 * @returns {{ present: boolean, deviceMemory: number | 'undefined' }}
 */
function readDeviceMemory () {
  const nav = /** @type {Navigator & { deviceMemory?: number }} */ (navigator)
  const present = 'deviceMemory' in nav
  const value = nav.deviceMemory
  return {
    present,
    deviceMemory: value === undefined ? 'undefined' : value
  }
}
