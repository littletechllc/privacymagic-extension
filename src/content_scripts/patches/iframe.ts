import { reflectApplySafe, makeBundleForInjection, getDisabledSettings, getTrustedTypesPolicy } from '../helpers'

const iframe = (): (() => void) => {
  const prepareInjectionForIframes = (hardeningCode: string): void => {
    if (self.HTMLIFrameElement === undefined) {
      return
    }

    // ## iframe hardening ##
    //
    // In a couple of cases, the iframe's contentWindow property is accessed
    // before the iframe has been hardened. We need to harden it first.
    //
    // Case #1: https://browserleaks.com/javascript has an
    // <iframe sandbox="allow-same-origin">. Because this iframe doesn't have
    // 'allow-scripts', the extension's content script doesn't run in the iframe's
    // context. Nonetheless, the parent frame can evaluate code in the sandboxed
    // iframe using the iframe's contentWindow property, e.g.
    // iframe.contentWindow.eval('navigator.hardwareConcurrency'), and retrieve
    // unhardened values.
    //
    // Case #2: In https://abrahamjuliot.github.io/creepjs/tests/iframes.html,
    // a same-origin iframe is created and immediately accessed in the same
    // task as the iframe creation. In this case, the iframe remains unhardened.
    //
    // To prevent this bypass, we need to inject our hardening
    // code from the parent frame into the any iframe before the parent
    // frame evaluates code in the sandboxed iframe.
    // We do this by overriding the iframe's contentWindow property with a
    // getter that injects our hardening code the first time it is accessed.
    //
    // TODO: Can we prevent the hardening code from running a second time?

    const evalSet = new WeakSet<Function>()

    const contentWindowDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')
    if (contentWindowDescriptor?.get === undefined) {
      throw new Error('contentWindow getter not found')
    }
    const contentWindowGetter = contentWindowDescriptor.get
    const weakSetHasDescriptor = Object.getOwnPropertyDescriptor(WeakSet.prototype, 'has')
    const weakSetAddDescriptor = Object.getOwnPropertyDescriptor(WeakSet.prototype, 'add')
    if (weakSetHasDescriptor?.value === undefined || weakSetAddDescriptor?.value === undefined) {
      throw new Error('WeakSet methods not found')
    }
    const weakSetHas = weakSetHasDescriptor.value
    const weakSetAdd = weakSetAddDescriptor.value

    /** **************** VULNERABLE FUNCTIONS SECTION **********************/
    // Function bodies here need to be carefully crafted to prevent invoking
    // anything that might have been monkey patched by pre-evaluated scripts.
    // Main vulnerabilities to avoid are:
    // - Accessing properties of global objects (e.g. console, self, document,
    //   vars, etc.)
    // - Accessing properties of objects that have a global prototype
    // - Evaluating globally-defined functions or Objects

    const getContentWindowSafe = (iframe: HTMLIFrameElement): Window | null => reflectApplySafe(contentWindowGetter, iframe, [])

    const weakSetHasSafe = <T extends object>(s: WeakSet<T>, v: T): boolean => reflectApplySafe(weakSetHas, s, [v])
    const weakSetAddSafe = <T extends object>(s: WeakSet<T>, v: T): WeakSet<T> => reflectApplySafe(weakSetAdd, s, [v])

    // Sometimes the iframe has not yet been hardened, so if the page is trying
    // to access the contentWindow, we need to harden it first.
    const getContentWindowAfterHardening = (iframe: HTMLIFrameElement, hardeningCode: string): Window | null => {
      const contentWin = getContentWindowSafe(iframe)
      // Accesing contentWin.eval is safe because, in order to monkey patch it,
      // the pre-evaluated script would need to access contentWin, which would
      // trigger our hardening code injection first.
      const evalFunction = contentWin.eval
      try {
        if (!weakSetHasSafe(evalSet, evalFunction)) {
          const policy = getTrustedTypesPolicy()
          evalFunction(policy.createScript(hardeningCode))
          weakSetAddSafe(evalSet, evalFunction)
        }
      } catch (error) {
        console.error('error hardening iframe', error)
      }
      return contentWin
    }

    /** **************** VULNERABLE FUNCTIONS SECTION END ******************/

    // Ensure eval is primed with hardening code before it is used.
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get () { return getContentWindowAfterHardening(this, hardeningCode) }
    })
  }
  return prepareInjectionForIframes(makeBundleForInjection(getDisabledSettings()))
}

export default iframe
