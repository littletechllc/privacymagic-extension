import { redefineMethods, redefinePrototypeFields } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const battery = (globalObject: GlobalScope): void => {
  if (globalObject.BatteryManager != null) {
    redefinePrototypeFields(globalObject.BatteryManager, {
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      onchargingchange: null,
      onchargingtimechange: null,
      ondischargingtimechange: null,
      onlevelchange: null
    })
    redefineMethods(globalObject.BatteryManager.prototype, {
      addEventListener: (/* ignore */) => { /* do nothing */ },
      removeEventListener: (/* ignore */) => { /* do nothing */ },
      dispatchEvent: (/* ignore */) => { /* do nothing */ },
    })
  }
}

export default battery
