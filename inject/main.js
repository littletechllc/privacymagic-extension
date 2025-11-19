/* global HTMLIFrameElement, Element, DOMTokenList, WeakSet, self, __disabledSettings */

import { reflectApplySafe, makeBundleForInjection } from './helpers.js';
import battery from './patches/battery.js';
import gpu from './patches/gpu.js';
import gpc from './patches/gpc.js';
import hardware from './patches/hardware.js';
import keyboard from './patches/keyboard.js';
import screen from './patches/screen.js';
import timer from './patches/timer.js';
import useragent from './patches/useragent.js';
import serviceWorker from './patches/serviceWorker.js';
import sharedStorage from './patches/sharedStorage.js';
import windowName from './patches/windowName.js';
import worker from './patches/worker.js';

const privacyMagicPatches = {
  battery,
  gpc,
  gpu,
  hardware,
  keyboard,
  screen,
  timer,
  useragent,
  serviceWorker,
  sharedStorage,
  windowName,
  worker
};

const runPatchesInPageExcept = (disabledPatches) => {
  const undoFunctions = Object.create(null);
  for (const patcherId of Object.keys(privacyMagicPatches)) {
    try {
      if (!disabledPatches.includes(patcherId)) {
        undoFunctions[patcherId] = privacyMagicPatches[patcherId]();
      }
    } catch (error) {
      console.error('error running patch', patcherId, error);
    }
  }
};

const prepareInjectionForIframes = (hardeningCode) => {
  if (!self.HTMLIFrameElement) {
    return;
  }

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
  // - Accessing properties of global objects (e.g. console, self, document,
  //   vars, etc.)
  // - Accessing properties of objects that have a global prototype
  // - Evaluating globally-defined functions or Objects

  const getContentWindowSafe = (iframe) => reflectApplySafe(contentWindowGetter, iframe, []);
  const getSandboxSafe = (iframe) => reflectApplySafe(sandboxGetter, iframe, []);
  const getDomTokenIncludesSafe = (list, token) => reflectApplySafe(domTokenIncludes, list, [token]);
  const getAttributeSafe = (element, attribute) => reflectApplySafe(attributeGetter, element, [attribute]);

  const weakSetHasSafe = (s, v) => reflectApplySafe(weakSetHas, s, [v]);
  const weakSetAddSafe = (s, v) => reflectApplySafe(weakSetAdd, s, [v]);

  const isSandboxedIframe = (iframe) => getAttributeSafe(iframe, 'sandbox') !== null;
  const hasAllowScriptsSandboxToken = (iframe) => getDomTokenIncludesSafe(getSandboxSafe(iframe), 'allow-scripts');
  const hasAllowSameOriginSandboxToken = (iframe) => getDomTokenIncludesSafe(getSandboxSafe(iframe), 'allow-same-origin');

  const getContentWindowAfterHardening = (iframe, hardeningCode) => {
    const contentWin = getContentWindowSafe(iframe);
    if (isSandboxedIframe(iframe) &&
        !hasAllowScriptsSandboxToken(iframe) &&
        hasAllowSameOriginSandboxToken(iframe)) {
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
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get () { return getContentWindowAfterHardening(this, hardeningCode); }
  });
};

const getDisabledSettingsFromCookie = () => {
  if (__disabledSettings !== undefined && __disabledSettings.length > 0) {
    return __disabledSettings;
  }
  let result = [];
  try {
    document.cookie.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key === '__pm__disabled_settings') {
        result = value.split(',');
      }
    });
    document.cookie = '__pm__disabled_settings=; Secure; SameSite=None; Path=/; Partitioned; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (result.length === 1 && result[0] === '') {
      result = [];
    }
  } catch (error) {
    console.error('error getting disabled settings from cookie:', error);
  }
  return result;
};

const mainFunction = () => {
  const disabledSettings = getDisabledSettingsFromCookie();
  runPatchesInPageExcept(disabledSettings);
  const bundle = makeBundleForInjection(disabledSettings);
  prepareInjectionForIframes(bundle);
};
mainFunction();
console.log('foreground.js loaded', Date.now());
