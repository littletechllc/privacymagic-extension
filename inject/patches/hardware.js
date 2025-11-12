/* global DevicePosture, Navigator */

import { redefinePropertyValues } from '../helpers.js';

const hardware = () => {
  // Match (color-gamut: srgb)
  const oldMatchMedia = window.matchMedia;
  const regex = /\(\s*color-gamut\s*:\s*([^)]+)\)/gi;
  const matchMediaClean = (mediaQueryString) =>
    mediaQueryString.replace(regex, (_, value) =>
      value.trim().toLowerCase() === 'srgb' ? ' all ' : ' not all ');
  const restoreMatchMedia = redefinePropertyValues(window, {
    matchMedia: mediaQueryString => oldMatchMedia(matchMediaClean(mediaQueryString))
  });
  const restoreNavigator = redefinePropertyValues(Navigator.prototype, {
    cpuClass: undefined,
    deviceMemory: 1,
    hardwareConcurrency: 4,
    maxTouchPoints: 0
  });
  let restoreDevicePosture;
  if (window.DevicePosture) {
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
