import type { GlobalScope } from '../helpers/globalObject'
import { getNavigatorConstructor } from '../helpers/globalObject'

// Global Privacy Control is a signal that allows users to opt out of websites
// selling or sharing their personal information with third parties.
// https://globalprivacycontrol.org/
const gpc = (globalObject: GlobalScope): void => {
  const getter = function() { return true }
  Object.defineProperties(getter, {
    name: { value: 'get globalPrivacyControl' },
    toString: { value: () => 'function get globalPrivacyControl() { [native code] }' }
  })
  Object.defineProperty(getNavigatorConstructor(globalObject).prototype, 'globalPrivacyControl', {
    get: getter,
    set: () => { /* do nothing */ },
    enumerable: true,
    configurable: true
  })
}

export default gpc
