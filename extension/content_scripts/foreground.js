/* global window, Navigator, Screen, innerWidth, innerHeight, BatteryManager, DevicePosture, NavigatorUAData */

(() => {
  const redefinePropertyValues = (obj, propertyMap) => {
    const properties = {};
    for (const [prop, value] of Object.entries(propertyMap)) {
      properties[prop] = { value, writable: true, enumerable: true };
    }
    Object.defineProperties(obj, properties);
  };

  const patches = {
    /*
    navigator: () => {
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
    },
    */
    gpc: () => {
      redefinePropertyValues(Navigator.prototype, {
        globalPrivacyControl: true
      });
    },
    hardware: () => {
      console.log('beforehardware patched: navigator.hardwareConcurrency = ', navigator.hardwareConcurrency);
      console.log('before hardware patched: navigator.deviceMemory =', navigator.deviceMemory);
      console.log('before hardware patched: navigator.maxTouchPoints =', navigator.maxTouchPoints);
      redefinePropertyValues(Navigator.prototype, {
        cpuClass: undefined,
        deviceMemory: 1,
        hardwareConcurrency: 4,
        maxTouchPoints: 1
      });
      redefinePropertyValues(DevicePosture.prototype, {
        type: 'continuous',
        addEventListener: (/* ignore */) => { /* do nothing */ },
        removeEventListener: (/* ignore */) => { /* do nothing */ },
        dispatchEvent: (/* ignore */) => { /* do nothing */ }
      });
      redefinePropertyValues(DevicePosture.prototype, {
        change: {
          get: () => { return null; },
          set: (value) => { /* do nothing */ },
          configurable: false,
          enumerable: true,
          writable: true
        }
      });
      console.log('after hardware patched: navigator.hardwareConcurrency = ', navigator.hardwareConcurrency);
      console.log('after hardware patched: navigator.deviceMemory =', navigator.deviceMemory);
      console.log('after hardware patched: navigator.maxTouchPoints =', navigator.maxTouchPoints);
    },
    screen: () => {
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
    },
    useragent: () => {
      const ChromeVersion = '141.0.0.0';
      const ShortChromeVersion = ChromeVersion.split('.')[0];
      redefinePropertyValues(Navigator.prototype, {
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ChromeVersion} Safari/537.36`,
        appVersion: `5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ChromeVersion} Safari/537.36`
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
        model: ''
      });
    },
    battery: () => {
      redefinePropertyValues(BatteryManager.prototype, {
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
        addEventListener: (/* ignore */) => { /* do nothing */ },
        removeEventListener: (/* ignore */) => { /* do nothing */ },
        dispatchEvent: (/* ignore */) => { /* do nothing */ }
      });
      const silencedEventProperty = {
        get: () => { return null; },
        set: (value) => { /* do nothing */ },
        configurable: true,
        enumerable: true
      };
      Object.defineProperties(BatteryManager.prototype, {
        onchargingchange: silencedEventProperty,
        onchargingtimechange: silencedEventProperty,
        ondischargingtimechange: silencedEventProperty,
        onlevelchange: silencedEventProperty
      });
    },
    window_name: () => {
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
      console.log('window.name patched');
    }
  };

  const isTopLevel = () => {
    try {
      // eslint-disable-next-line no-unused-expressions
      window.top.location.href;
      return true;
    } catch (_) {
      return false;
    }
  };


  const injectPatchesInPage = () => {
    const topLevel = isTopLevel();
    for (const [patcherId, decision] of Object.entries(window.__patch_decisions__)) {
      if (decision || !topLevel) {
        console.log('injecting patch', patcherId);
        patches[patcherId]();
      }
    }
  };

  const bundleActivePatches = () => {
    const topLevel = isTopLevel();
    const preamble = `// helper function\nconst redefinePropertyValues = ${redefinePropertyValues.toString()};`;
    const bundleItems = [preamble];
    for (const [patcherId, decision] of Object.entries(window.__patch_decisions__)) {
      if (decision || !topLevel) {
        bundleItems.push(`// ${patcherId}\n(${patches[patcherId]})();`);
      }
    }
    return `(() => {\n${bundleItems.join('\n\n')}\n})();`;
  }


  const reflectApply = Reflect.apply;

  const contentWindowGetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
  const contentWindowGetterSafe = (iframe) => reflectApply(contentWindowGetter, iframe, []);

  const injectIframeWithCode = (iframe, code) => {
    try {
      contentWindowGetterSafe(iframe).eval(code);
      console.log('injected code into iframe', iframe);
    } catch (error) {
      console.error('error evaluating code in iframe', error);
    }
  };

  const addEventListener = EventTarget.prototype.addEventListener;
  const addEventListenerSafe = (target, type, listener, options) =>
    reflectApply(addEventListener, target, [type, listener, options]);

  const prepareInjectionForIframes = (bundle) => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLIFrameElement) {
              injectIframeWithCode(node, bundle);
              addEventListenerSafe(node, 'load', () => {
                injectIframeWithCode(node, bundle);
              });
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  window.__patch_decisions__ ||= {};

  window.__inject_if_ready__ = () => {
    console.log('inject if ready', window.__patch_decisions__);
    if (Object.keys(window.__patch_decisions__).length === Object.keys(patches).length) {
      console.log('injecting patches', window.__patch_decisions__);
      injectPatchesInPage();
      const bundle = bundleActivePatches();
      console.log('bundle:', bundle);
      prepareInjectionForIframes(bundle);
      delete window.__patch_decisions__;
      delete window.__inject_if_ready__;
    }
  };

  window.__inject_if_ready__();
})();

console.log('foreground.js loaded', Date.now());
