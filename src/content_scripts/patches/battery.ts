import { redefinePropertyValues } from '../helpers';

const battery = () => {
  let restoreBatteryManager;
  if (self.BatteryManager) {
    const silencedEventProperty = {
      get: () => { return null; },
      set: (_value: unknown) => { /* do nothing */ },
      configurable: true,
      enumerable: true
    };
    restoreBatteryManager = redefinePropertyValues(BatteryManager.prototype, {
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
    });
  }
};

export default battery;
