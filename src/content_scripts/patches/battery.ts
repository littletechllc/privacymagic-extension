import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

const battery = (): void => {
  if (self.BatteryManager != null) {
    redefinePropertyValues(BatteryManager.prototype, {
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      addEventListener: (/* ignore */) => { /* do nothing */ },
      removeEventListener: (/* ignore */) => { /* do nothing */ },
      dispatchEvent: (/* ignore */) => { /* do nothing */ },
      onchargingchange: null,
      onchargingtimechange: null,
      ondischargingtimechange: null,
      onlevelchange: null
    })
  }
}

export default battery
