/* global window, Navigator, Screen, innerWidth, innerHeight */

(() => {
  const redefinePropertyValues = (obj, propertyMap) => {
    const properties = {};
    for (const [prop, value] of Object.entries(propertyMap)) {
      properties[prop] = { value, writable: true, enumerable: true };
    }
    Object.defineProperties(obj, properties);
  };

  window.redefineNavigator = () => {
    redefinePropertyValues(Navigator.prototype, {
      cookieEnabled: true,
      //  doNotTrack: '1',
      //  languages: [navigator.language],
      maxTouchPoints: 1,
      onLine: true,
      // oscpu: undefined,
      pdfViewerEnabled: true,
      platform: 'Windows',
      productSub: '20030107',
      vendor: 'Google Inc.',
      // vendorSub: ''
      webdriver: false,
    });
  };

  window.redefineGlobalPrivacyControl = () => {
    redefinePropertyValues(Navigator.prototype, {
      globalPrivacyControl: true
    });
  };

  window.redefineHardware = () => {
    redefinePropertyValues(Navigator.prototype, {
      cpuClass: undefined,
      deviceMemory: 1,
      hardwareConcurrency: 4,
      maxTouchPoints: 1
    });
    redefinePropertyValues(DevicePosture.prototype, {
      type: 'continuous',
      addEventListener: ( /* ignore */) => { /* do nothing */ },
      removeEventListener: ( /* ignore */) => { /* do nothing */ },
      dispatchEvent: ( /* ignore */) => { /* do nothing */ },
    });
    redefinePropertyValues(DevicePosture.prototype, {
      change: {
        get: () => { return null; },
        set: (value) => { /* do nothing */ },
        configurable: false,
        enumerable: true,
        writable: true
      },
    });
  };

  window.redefineScreen = () => {
    console.log('redefineScreen');

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
          return [width, height];
        }
      }
      return allowedScreenSizes[allowedScreenSizes.length - 1];
    };

    const [spoofedScreenWidth, spoofedScreenHeight] = spoofScreenSize(innerWidth, innerHeight);

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
  };

  window.redefineUserAgent = () => {
    console.log('redefineUserAgent');
    const ChromeVersion = '141.0.0.0';
    const ShortChromeVersion = ChromeVersion.split('.')[0];
    redefinePropertyValues(Navigator.prototype, {
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ChromeVersion} Safari/537.36`,
      appVersion: `	5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ChromeVersion} Safari/537.36`,
    });
    redefinePropertyValues(NavigatorUAData.prototype, {
      brands: [
        { brand: 'Google Chrome', version: ShortChromeVersion },
        { brand: 'Not?A_Brand', version: '8' },
        { brand: 'Chromium', version: ShortChromeVersion }
      ],
      uaFullVersion: ChromeVersion,
      fullVersionList: [
        { brand: 'Google Chrome', version: ChromeVersion },
        { brand: 'Not?A_Brand', version: '8.0.0.0' },
        { brand: 'Chromium', version: ChromeVersion }
      ],
      wow64: false,
      bitness: 64,
      platform: 'Windows',
      architecture: 'arm',
      mobile: false,
      formFactors: ['Desktop'],
      platformVersion: '26.0.0',
      mobile: false,
      model: '',
    });
  };

  window.redefineBattery = () => {
    console.log('redefineBattery');
    redefinePropertyValues(BatteryManager.prototype, {
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      addEventListener: ( /* ignore */) => { /* do nothing */ },
      removeEventListener: ( /* ignore */) => { /* do nothing */ },
      dispatchEvent: ( /* ignore */) => { /* do nothing */ },
    });
    const silencedEventProperty = {
      get: () => { return null; },
      set: (value) => { /* do nothing */ },
      configurable: false,
      enumerable: true,
      writable: true
    }
    Object.defineProperties(BatterManager.prototype, {
      onchargingchange: silencedEventProperty,
      onchargingtimechange: silencedEventProperty,
      ondischargingtimechange: silencedEventProperty,
      onlevelchange: silencedEventProperty,
    });
  };

  window.redefineWindowName = () => {
    console.log('redefineWindowName');
    const propDescriptor = Object.getOwnPropertyDescriptor(window, 'name');
    if (!propDescriptor) {
      return;
    }
    const nameGetter = propDescriptor.get;
    const nameSetter = propDescriptor.set;
    Object.defineProperty(window, 'name', {
      get () {
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
      set (value) {
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
  };
})();
