/* global DevicePosture, self */

import { redefinePropertyValues } from '../helpers.js';

const hardware = () => {
  // Match (color-gamut: srgb)
  const oldMatchMedia = self.matchMedia;
  const regex = /\(\s*color-gamut\s*:\s*([^)]+)\)/gi;
  const matchMediaClean = (mediaQueryString) =>
    mediaQueryString.replace(regex, (_, value) =>
      value.trim().toLowerCase() === 'srgb' ? ' all ' : ' not all ');
  const restoreMatchMedia = redefinePropertyValues(self, {
    matchMedia: mediaQueryString => oldMatchMedia(matchMediaClean(mediaQueryString))
  });
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  const restoreNavigator = redefinePropertyValues(navigatorPrototype.prototype, {
    cpuClass: undefined,
    // Cover Your Tracks says 1 in 1.93 browsers have this value:
    deviceMemory: undefined,
    hardwareConcurrency: 4,
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
    restoreMatchMedia();
    restoreNavigator();
    if (restoreDevicePosture) {
      restoreDevicePosture();
    }
  };
};

export default hardware;
