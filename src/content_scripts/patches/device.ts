import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const device = (globalObject: GlobalScope): void => {
  if (globalObject.DevicePosture != null) {
    redefinePropertyValues(globalObject.DevicePosture.prototype, {
      type: 'continuous',
      addEventListener: (/* ignore */) => { /* do nothing */ },
      removeEventListener: (/* ignore */) => { /* do nothing */ },
      dispatchEvent: (/* ignore */) => { /* do nothing */ },
      change: {
        get: () => { return null },
        set: (/* _value: unknown */) => { /* do nothing */ },
        configurable: false,
        enumerable: true,
        writable: true
      }
    })
  }
}

export default device
