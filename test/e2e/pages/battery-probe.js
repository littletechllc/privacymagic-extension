const pageOnly = true

/**
 * JSON has no Infinity, and JSON.stringify turns functions into null.
 * @param {unknown} value
 */
const describe = (value) => {
  if (typeof value === 'function') {
    return 'function'
  }
  if (value === Infinity) {
    return 'Infinity'
  }
  if (value === -Infinity) {
    return '-Infinity'
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return 'NaN'
  }
  return value
}

async function runProbe () {
  const nav = /** @type {Navigator & { getBattery?: () => Promise<BatteryManager> }} */ (navigator)
  if (typeof nav.getBattery !== 'function') {
    throw new Error('navigator.getBattery is not a function')
  }
  const battery = await nav.getBattery()
  const handler = () => {}
  battery.onchargingchange = handler
  battery.onchargingtimechange = handler
  battery.ondischargingtimechange = handler
  battery.onlevelchange = handler
  return {
    charging: describe(battery.charging),
    chargingTime: describe(battery.chargingTime),
    dischargingTime: describe(battery.dischargingTime),
    level: describe(battery.level),
    onchargingchange: describe(battery.onchargingchange),
    onchargingtimechange: describe(battery.onchargingtimechange),
    ondischargingtimechange: describe(battery.ondischargingtimechange),
    onlevelchange: describe(battery.onlevelchange)
  }
}
