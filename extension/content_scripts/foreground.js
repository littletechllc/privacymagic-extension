const redefineAPIs = function (exemptions = []) {

//console.log("Hello from content script", window.location.href, top.location?.href)


const redefinePropertyValues = (obj, propertyMap) => {
  let properties = {}
  for (const [prop, value] of Object.entries(propertyMap)) {
    properties[prop] = { value, writable: true, enumerable: true }
  }
  Object.defineProperties(obj, properties)
};

if (!exemptions.includes('screen')) {

const oldMatchMedia = window.matchMedia;

const mediaDeviceToViewport = (mediaQueryString) =>
  mediaQueryString
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
      return [width, height]
    }
  }
  return allowedScreenSizes[allowedScreenSizes.length - 1]
};

const [spoofedScreenWidth, spoofedScreenHeight] = spoofScreenSize(innerWidth, innerHeight);

redefinePropertyValues(Navigator.prototype, {
  cookieEnabled: true,
  cpuClass: undefined,
  deviceMemory: 1,
//  doNotTrack: '1',
  globalPrivacyControl: true,
  hardwareConcurrency: 4,
//  languages: [navigator.language],
  maxTouchPoints: 1,
  onLine: true,
  oscpu: undefined,
  pdfViewerEnabled: true,
  platform: 'Windows',
  productSub: '20030107',
  vendor: 'Google Inc.',
 // vendorSub: ''
});
redefinePropertyValues(Screen.prototype, {
  availHeight: spoofedScreenHeight,
  availLeft: 0,
  availTop: 0,
  availWidth: spoofedScreenWidth,
  colorDepth: 24,
  height: spoofedScreenHeight,
  pixelDepth: 24,
  width: spoofedScreenWidth
});
redefinePropertyValues(window, {
  devicePixelRatio: 1,
  matchMedia: (mediaQueryString) => oldMatchMedia(mediaDeviceToViewport(mediaQueryString)),
  outerHeight: window.innerHeight,
  outerWidth: window.innerWidth,
  screenLeft: 0,
  screenTop: 0,
  screenX: 0,
  screenY: 0
});
}

if (!exemptions.includes('window_name')) {

  const propDescriptor = Object.getOwnPropertyDescriptor(window, 'name');
  if (!propDescriptor) {
    return;
  }
  const nameGetter = propDescriptor.get;
  const nameSetter = propDescriptor.set;
  Object.defineProperty(window, 'name', {
    get() {
      const nameStr = nameGetter.call(this);
      try {
        const data = JSON.parse(nameStr);
        if (typeof data !== 'object' || data === null) {
          return '';
        }
        const origin = window.location.origin;
        if (typeof data[origin] !== 'string') {
          return '';
        }
        return data[origin];
      } catch (error) {
        return '';
      }
    },
    set(value) {
      const nameStr = nameGetter.call(this);
      let data;
      try { 
        data = JSON.parse(nameStr);
        if (typeof data !== 'object' || data === null) {
          data = {};
        }
      } catch (error) {
        data = {};
      }
      const origin = window.location.origin;
      if (!origin || origin.length === 0) {
        return;
      }
      // String(value) matches window.name native behavior
      data[origin] = String(value);
      nameSetter.call(this, JSON.stringify(data));
    },
    configurable: true
  });
}

};
