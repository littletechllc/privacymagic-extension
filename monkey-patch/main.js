/* global HTMLIFrameElement, Element, DOMTokenList, WeakSet, chrome */

import { reflectApplySafe, definePropertiesSafe, redefinePropertyValues } from './helpers.js';
import battery from './patches/battery.js';
import gpc from './patches/gpc.js';
import hardware from './patches/hardware.js';
import keyboard from './patches/keyboard.js';
import screen from './patches/screen.js';
import timer from './patches/timer.js';
import useragent from './patches/useragent.js';
import windowName from './patches/windowName.js';

const DATA_SECRET_ATTRIBUTE = 'data-privacy-magic-secret';
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

const privacyMagicPatches = {
  battery,
  gpc,
  hardware,
  keyboard,
  screen,
  timer,
  useragent,
  windowName
};

const isTopLevel = window.top === window;

const injectPatchesInPage = () => {
  const undoFunctions = Object.create(null);
  for (const [patcherId, decision] of Object.entries(window.__patch_decisions__)) {
    if (decision || !isTopLevel) {
      console.log('injecting patch', patcherId);
      undoFunctions[patcherId] = privacyMagicPatches[patcherId]();
    }
  }
  return undoFunctions;
};

const bundleActivePatches = () => {
  const preamble = `// helper function
  const reflectApplySafe = ${reflectApplySafe.toString()};
  const definePropertiesSafe = ${definePropertiesSafe.toString()};
  const nonProperty = { get: undefined, set: undefined, configurable: true };
  const redefinePropertyValues = ${redefinePropertyValues.toString()};
  `;
  console.log({ preamble });
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

const getContentWindowSafe = (iframe) => reflectApplySafe(contentWindowGetter, iframe, []);
const getSandboxSafe = (iframe) => reflectApplySafe(sandboxGetter, iframe, []);
const getDomTokenIncludesSafe = (list, token) => reflectApplySafe(domTokenIncludes, list, [token]);
const getAttributeSafe = (element, attribute) => reflectApplySafe(attributeGetter, element, [attribute]);

const weakSetHasSafe = (s, v) => reflectApplySafe(weakSetHas, s, [v]);
const weakSetAddSafe = (s, v) => reflectApplySafe(weakSetAdd, s, [v]);

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

window.__patch_decisions__ ||= Object.create(null);

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
    document.documentElement.addEventListener(`message-${sharedSecret}`, ({ detail }) => {
      try {
        // detail.type should be safe because detail is a null-prototype object.
        if (detail.type === 'getDisabledSettingsResponse') {
          const { disabledSettings } = detail;
          for (const settingId of disabledSettings) {
            // Should be safe because settingId is a string and
            // undoFunctions is a null-prototype object.
            const undoFunction = undoFunctions[settingId];
            if (undoFunction) {
              undoFunction();
            }
          }
        }
      } catch (error) {
        console.error('unexpected error');
      }
    });
  }
};
window.__inject_if_ready__();
console.log('foreground.js loaded at document_start with secret:', sharedSecret, Date.now());
