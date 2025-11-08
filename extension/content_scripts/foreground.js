/* global BatteryManager, chrome, DevicePosture, DOMTokenList, Element,
          HTMLIFrameElement, innerHeight, innerWidth, Navigator,
          NavigatorUAData, Screen, window */

(() => {
  const DATA_SECRET_ATTRIBUTE = "data-privacy-magic-secret";
  const sharedSecret = (() => {
    const documentElement = document.documentElement;
    const existingSecret = documentElement.getAttribute(DATA_SECRET_ATTRIBUTE);
    if (existingSecret !== null) {
      documentElement.removeAttribute(DATA_SECRET_ATTRIBUTE);
      return existingSecret;
    } else {
      let newSecret;
      try {
        newSecret = crypto.randomUUID();
      } catch (error) {
        newSecret = Math.random().toString(16).substring(2);
      }
      documentElement.setAttribute(DATA_SECRET_ATTRIBUTE, newSecret);
      return newSecret;
    }
  })();

  const redefinePropertyValues = (obj, propertyMap) => {
    const properties = {};
    const originalProperties = {};
    for (const [prop, value] of Object.entries(propertyMap)) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      originalProperties[prop] = descriptor || { get: undefined, set: undefined, configurable: true };
      if (!descriptor) {
        properties[prop] = { configurable: true, get: () => value };
      } else if (descriptor.value) {
        properties[prop] = { ...descriptor, value };
      } else {
        properties[prop] = { ...descriptor, get: () => value };
      }
    }
    Object.defineProperties(obj, properties);
    // Return a function that restores the original properties.
    // We use definePropertiesSafe to avoid invoking Object.defineProperties
    // because the original function might be monkey patched by pre-evaluated
    // scripts.
    const definePropertiesSafe = Object.defineProperties;
    return () => {
      definePropertiesSafe(obj, originalProperties);
    };
  };

  // The privacyMagicPatches object contains a series of patches. Each patch
  // has a name (the key) and a corresponding function that monkey patches
  // one or more Web APIs to harden them against fingerprinting or other
  // privacy-invasive attacks. Each patch function returns an "undo" function
  // that restores the original properties. We need the undo function for any
  // tab for which protections have been disabled.
  const privacyMagicPatches = {
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
      console.log('gpc patch', window.location.href);
      return redefinePropertyValues(Navigator.prototype, {
        globalPrivacyControl: true
      });
    },
    hardware: () => {
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
      const restoreDevicePosture = redefinePropertyValues(DevicePosture.prototype, {
        type: 'continuous',
        addEventListener: (/* ignore */) => { /* do nothing */ },
        removeEventListener: (/* ignore */) => { /* do nothing */ },
        dispatchEvent: (/* ignore */) => { /* do nothing */ }
      });
      const restoreDevicePostureChange = redefinePropertyValues(DevicePosture.prototype, {
        change: {
          get: () => { return null; },
          set: (value) => { /* do nothing */ },
          configurable: false,
          enumerable: true,
          writable: true
        }
      });
      return () => {
        restoreMatchMedia();
        restoreNavigator();
        restoreDevicePosture();
        restoreDevicePostureChange();
      };
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
      const restoreWindow = redefinePropertyValues(window, {
        devicePixelRatio: 1,
        matchMedia: (mediaQueryString) => oldMatchMedia(mediaDeviceToViewport(mediaQueryString)),
        outerHeight: window.innerHeight,
        outerWidth: window.innerWidth,
        screenLeft: 0,
        screenTop: 0,
        screenX: 0,
        screenY: 0
      });
      return () => {
        restoreScreen();
        restoreWindow();
      };
    },
    useragent: () => {
      const CHROME_VERSION = '141.0.0.0';
      const SHORT_CHROME_VERSION = CHROME_VERSION.split('.')[0];
      const PLATFORM_VERSION = '26.0.0';
      const BRAND_VERSION = '8.0.0.0';
      const SHORT_BRAND_VERSION = BRAND_VERSION.split('.')[0];
      const restoreNavigator = redefinePropertyValues(Navigator.prototype, {
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`,
        appVersion: `5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`
      });
      const restoreNavigatorUAData = redefinePropertyValues(NavigatorUAData.prototype, {
        brands: [
          { brand: 'Google Chrome', version: SHORT_CHROME_VERSION },
          { brand: 'Not?A_Brand', version: SHORT_BRAND_VERSION },
          { brand: 'Chromium', version: SHORT_CHROME_VERSION }
        ],
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async () => (
          {
            architecture: 'arm',
            bitness: '64',
            brands: [
              { brand: 'Google Chrome', version: SHORT_CHROME_VERSION },
              { brand: 'Not?A_Brand', version: SHORT_BRAND_VERSION },
              { brand: 'Chromium', version: SHORT_CHROME_VERSION }
            ],
            formFactors: [
              'Desktop'
            ],
            fullVersionList: [
              { brand: 'Google Chrome', version: CHROME_VERSION },
              { brand: 'Not?A_Brand', version: BRAND_VERSION },
              { brand: 'Chromium', version: CHROME_VERSION }
            ],
            mobile: false,
            model: '',
            platform: 'macOS',
            platformVersion: PLATFORM_VERSION,
            uaFullVersion: CHROME_VERSION,
            wow64: false
          })
      });
      return () => {
        restoreNavigator();
        restoreNavigatorUAData();
      };
    },
    battery: () => {
      const restoreBatteryManager = redefinePropertyValues(BatteryManager.prototype, {
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
      const restoreBatteryManagerEvents = redefinePropertyValues(BatteryManager.prototype, {
        onchargingchange: silencedEventProperty,
        onchargingtimechange: silencedEventProperty,
        ondischargingtimechange: silencedEventProperty,
        onlevelchange: silencedEventProperty
      });
      return () => {
        restoreBatteryManager();
        restoreBatteryManagerEvents();
      };
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

  const isTopLevel = window.top === window;

  const injectPatchesInPage = () => {
    const undoFunctions = {};
    for (const [patcherId, decision] of Object.entries(window.__patch_decisions__)) {
      if (decision || !isTopLevel) {
        console.log('injecting patch', patcherId);
        undoFunctions[patcherId] = privacyMagicPatches[patcherId]();
      }
    }
    return undoFunctions;
  };

  const bundleActivePatches = () => {
    const preamble = `// helper function\nconst redefinePropertyValues = ${redefinePropertyValues.toString()};`;
    const bundleItems = [preamble];
    for (const [patcherId, decision] of Object.entries(window.__patch_decisions__)) {
      if (decision || !isTopLevel) {
        bundleItems.push(`// ${patcherId}\n(${privacyMagicPatches[patcherId]})();`);
      }
    }
    return `(() => {\n${bundleItems.join('\n\n')}\n})();`;
  };

  // ## Sandboxed Iframes hardening ##
  //
  // Here we handle sandboxed iframes. See for example,
  // https://browserleaks.com/javascript,
  // which has an <iframe sandbox="allow-same-origin">.
  // Because this iframe doesn't have 'allow-scripts', the extension's
  // content script doesn't run in the iframe's context.
  // Nonetheless, the parent frame can evaluate code in the sandboxed iframe
  // using the iframe's contentWindow property, e.g.
  // iframe.contentWindow.eval('navigator.hardwareConcurrency'),
  // and retrieve unhardened values.
  // To prevent this bypass, we need to inject our hardening code
  // from the parent frame into the sandboxed iframe before the parent
  // frame evaluates code in the sandboxed iframe.
  // We do this by overriding the iframe's contentWindow property with a
  // getter that injects our hardening code the first time it is accessed.

  const evalSet = new WeakSet();

  const reflectApply = Reflect.apply;
  const contentWindowGetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
  const sandboxGetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'sandbox').get;
  const attributeGetter = Object.getOwnPropertyDescriptor(Element.prototype, 'getAttribute').value;
  const domTokenIncludes = Object.getOwnPropertyDescriptor(DOMTokenList.prototype, 'contains').value;

  const weakSetHas = Object.getOwnPropertyDescriptor(WeakSet.prototype, 'has').value;
  const weakSetAdd = Object.getOwnPropertyDescriptor(WeakSet.prototype, 'add').value;

  /** **************** VULNERABLE FUNCTIONS SECTION **********************/
  // Function bodies here need to be carefully crafted to prevent invoking
  // anything that might have been monkey patched by pre-evaluated scripts.
  // Main vulnerabilities to avoid are:
  // - Accessing properties of global objects (e.g. console, window, document,
  //   vars, etc.)
  // - Accessing properties of objects that have a global prototype
  // - Evaluating globally-defined functions or Objects

  const getContentWindowSafe = (iframe) => reflectApply(contentWindowGetter, iframe, []);
  const getSandboxSafe = (iframe) => reflectApply(sandboxGetter, iframe, []);
  const getDomTokenIncludesSafe = (list, token) => reflectApply(domTokenIncludes, list, [token]);
  const getAttributeSafe = (element, attribute) => reflectApply(attributeGetter, element, [attribute]);

  const weakSetHasSafe = (s, v) => reflectApply(weakSetHas, s, [v]);
  const weakSetAddSafe = (s, v) => reflectApply(weakSetAdd, s, [v]);

  const isSandboxedIframe = (iframe) => getAttributeSafe(iframe, 'sandbox') !== null;
  const hasAllowScriptsSandboxToken = (iframe) => getDomTokenIncludesSafe(getSandboxSafe(iframe), 'allow-scripts');

  const getContentWindowAfterHardening = (iframe, hardeningCode) => {
    const contentWin = getContentWindowSafe(iframe);
    if (isSandboxedIframe(iframe) && !hasAllowScriptsSandboxToken(iframe)) {
      // Accesing contentWin.eval is safe because, in order to monkey patch it,
      // the pre-evaluated script would need to access contentWin, which would
      // trigger our hardening code injection first. Note we are assuming here
      // that the sandboxed iframe does not have 'allow-scripts'.
      const evalFunction = contentWin.eval;
      if (!weakSetHasSafe(evalSet, evalFunction)) {
        evalFunction(hardeningCode);
        weakSetAddSafe(evalSet, evalFunction);
      }
    }
    return contentWin;
  };

  /** **************** VULNERABLE FUNCTIONS SECTION END ******************/

  // Ensure eval is primed with hardening code before it is used.
  const prepareInjectionForIframes = (hardeningCode) => {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get () { return getContentWindowAfterHardening(this, hardeningCode); }
    });
  };

  window.__patch_decisions__ ||= {};

  window.__inject_if_ready__ = () => {
    if (Object.keys(window.__patch_decisions__).length === Object.keys(privacyMagicPatches).length) {
      console.log('injecting patches', window.__patch_decisions__);
      window.__chrome = chrome;
      const undoFunctions = injectPatchesInPage();
      const bundle = bundleActivePatches();
      prepareInjectionForIframes(bundle);
      delete window.__patch_decisions__;
      delete window.__inject_if_ready__;
      console.log('isTopLevel', isTopLevel);
      if (isTopLevel) {
        return;
      }
      console.log('listening for message events on foreground.js');
      // TODO: Make the following event-listener safe against monkey patching.
      document.documentElement.addEventListener(`message-${sharedSecret}`, ({ detail }) => {
        console.log('message event received on foreground.js', detail);
        if (detail.type === 'getDisabledSettingsResponse') {
          console.log('getDisabledSettingsResponse received on foreground.js', detail);
          const { disabledSettings } = detail;
          console.log('disabledSettings', disabledSettings);
          for (const settingId of disabledSettings) {
            console.log('undoing patch', settingId);
            const undoFunction = undoFunctions[settingId];
            if (undoFunction) {
              undoFunction();
            }
          }
        }
      });
    }
  };
  window.__inject_if_ready__();
  console.log('foreground.js loaded at document_start with secret:', sharedSecret, Date.now());
})();
