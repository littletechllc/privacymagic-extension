/* global DevicePosture, self */

import { redefinePropertyValues } from '../helpers.js';

const device = () => {
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  const restoreNavigator = redefinePropertyValues(navigatorPrototype.prototype, {
    // Cover Your Tracks: 1 in 1.74:
    maxTouchPoints: 0
  });
  let restoreDevicePosture;
  if (self.DevicePosture) {
    restoreDevicePosture = redefinePropertyValues(DevicePosture.prototype, {
      type: 'continuous',
      addEventListener: (/* ignore */) => { /* do nothing */ },
      removeEventListener: (/* ignore */) => { /* do nothing */ },
      dispatchEvent: (/* ignore */) => { /* do nothing */ },
      change: {
        get: () => { return null; },
        set: (value) => { /* do nothing */ },
        configurable: false,
        enumerable: true,
        writable: true
      }
    });
  }
  return () => {
    restoreNavigator();
    if (restoreDevicePosture) {
      restoreDevicePosture();
    }
  };
};

export default device;
