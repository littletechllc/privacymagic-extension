/* global innerWidth, innerHeight, Screen */

import { redefinePropertyValues } from '../helpers.js';

const screen = () => {
  if (!self.Screen) {
    return () => {};
  }
  const oldMatchMedia = self.matchMedia;
  const mediaDeviceToViewport = (mediaQueryString) => mediaQueryString
      ?.replaceAll('device-width', 'width')
      ?.replaceAll('device-height', 'height');
  const allowedScreenSizes = [
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160]
  ];
  const spoofScreenSize = (minWidth, minHeight) => {
    for (const [width, height] of allowedScreenSizes) {
      if (width >= minWidth && height >= minHeight) {
        return [width, height];
      }
    }
    return allowedScreenSizes[allowedScreenSizes.length - 1];
  };
  const [spoofedScreenWidth, spoofedScreenHeight] = spoofScreenSize(innerWidth, innerHeight);
  const restoreScreen = redefinePropertyValues(Screen.prototype, {
    availHeight: spoofedScreenHeight,
    availLeft: 0,
    availTop: 0,
    availWidth: spoofedScreenWidth,
    colorDepth: 24,
    height: spoofedScreenHeight,
    pixelDepth: 24,
    width: spoofedScreenWidth
  });
  const restoreWindow = redefinePropertyValues(self, {
    devicePixelRatio: 2,
    matchMedia: (mediaQueryString) => oldMatchMedia(mediaDeviceToViewport(mediaQueryString)),
    outerHeight: self.innerHeight,
    outerWidth: self.innerWidth,
    screenLeft: 0,
    screenTop: 0,
    screenX: 0,
    screenY: 0
  });
  return () => {
    restoreScreen();
    restoreWindow();
  };
};

export default screen;
