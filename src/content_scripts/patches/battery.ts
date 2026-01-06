import { redefinePropertyValues } from '../helpers'

const battery = (): (() => void) | undefined => {
  if (self.BatteryManager != null) {
    const silencedEventProperty = {
      get: () => { return null },
      set: (_value: unknown) => { /* do nothing */ },
      configurable: true,
      enumerable: true
    }
    return redefinePropertyValues(BatteryManager.prototype, {
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      addEventListener: (/* ignore */) => { /* do nothing */ },
      removeEventListener: (/* ignore */) => { /* do nothing */ },
      dispatchEvent: (/* ignore */) => { /* do nothing */ },
      onchargingchange: silencedEventProperty,
      onchargingtimechange: silencedEventProperty,
      ondischargingtimechange: silencedEventProperty,
      onlevelchange: silencedEventProperty
    })
  }
  return undefined
}

export default battery
