import { redefinePrototypeFields, redefineMethods } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const device = (globalObject: GlobalScope): void => {
  if (globalObject.DevicePosture != null) {
    redefinePrototypeFields(globalObject.DevicePosture, {
      type: 'continuous',
      onchange: null
    })
    redefineMethods(globalObject.DevicePosture.prototype, {
      addEventListener: (/* ignore */) => { /* do nothing */ },
      removeEventListener: (/* ignore */) => { /* do nothing */ },
      dispatchEvent: (/* ignore */) => { /* do nothing */ },
    })
  }
}

export default device
