/* global self, HTMLIFrameElement, Element, DOMTokenList, WeakSet */
import { reflectApplySafe, makeBundleForInjection, getDisabledSettings, getTrustedTypesPolicy } from '../helpers.js';

const iframe = () => {
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

    const weakSetHasSafe = (s, v) => reflectApplySafe(weakSetHas, s, [v]);
    const weakSetAddSafe = (s, v) => reflectApplySafe(weakSetAdd, s, [v]);

    // Sometimes the iframe has not yet been hardened, so if the page is trying
    // to access the contentWindow, we need to harden it first.
    const getContentWindowAfterHardening = (iframe, hardeningCode) => {
      const contentWin = getContentWindowSafe(iframe);
      // Accesing contentWin.eval is safe because, in order to monkey patch it,
      // the pre-evaluated script would need to access contentWin, which would
      // trigger our hardening code injection first.
      const evalFunction = contentWin.eval;
      try {
        if (!weakSetHasSafe(evalSet, evalFunction)) {
          const policy = getTrustedTypesPolicy();
          evalFunction(policy.createScript(hardeningCode));
          weakSetAddSafe(evalSet, evalFunction);
        }
      } catch (error) {
        console.error('error hardening iframe', error);
      }
      return contentWin;
    };

    /** **************** VULNERABLE FUNCTIONS SECTION END ******************/

    // Ensure eval is primed with hardening code before it is used.
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get () { return getContentWindowAfterHardening(this, hardeningCode); }
    });
  };
  return prepareInjectionForIframes(makeBundleForInjection(getDisabledSettings()));
};

export default iframe;
