import { createSafeGetter } from '@src/content_scripts/helpers/monkey-patch'
import { weakSetHasSafe, weakSetAddSafe } from '@src/content_scripts/helpers/safe'
import { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { applyPatchesToGlobalObject } from '../helpers/patch'

const iframe = (globalObject: GlobalScope): undefined => {
  if (globalObject.HTMLIFrameElement === undefined) {
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
  // unhardened values. It can also directly access the iframe's contentWindow
  // properties, e.g. iframe.contentWindow.location.href, and retrieve unhardened
  // values.
  //
  // Case #2: In https://abrahamjuliot.github.io/creepjs/tests/iframes.html,
  // a same-origin iframe is created and immediately accessed in the same
  // task as the iframe creation. In this case, the iframe remains unhardened.
  //
  // To prevent this bypass we apply our patches to the iframe's contentWindow
  // object property, which is a global object similar to the global object of
  // the parent frame.
  //
  // TODO: Can we prevent hardening patches from running a second time?

  const contentWinSet = new WeakSet<Window>()

  const getContentWindowSafe = createSafeGetter(globalObject.HTMLIFrameElement, 'contentWindow')

  // Sometimes the iframe has not yet been hardened, so if the page is trying
  // to access the contentWindow, we need to harden it first.
  const getContentWindowAfterHardening = (iframe: HTMLIFrameElement): Window | null => {
    const contentWin = getContentWindowSafe(iframe)
    if (contentWin == null || weakSetHasSafe(contentWinSet, contentWin)) {
      // Nothing to harden or already hardened.
      return contentWin
    }
    applyPatchesToGlobalObject(contentWin as GlobalScope)
    weakSetAddSafe(contentWinSet, contentWin)
    return contentWin
  }

  Object.defineProperty(globalObject.HTMLIFrameElement.prototype, 'contentWindow', {
    get(this: HTMLIFrameElement) {
      return getContentWindowAfterHardening(this)
    }
  })
}

export default iframe
