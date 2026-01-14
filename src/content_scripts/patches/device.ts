import { redefinePropertyValues } from '../helpers'

const device = (): void => {
  if (self.DevicePosture !== null && self.DevicePosture !== undefined) {
    redefinePropertyValues(DevicePosture.prototype, {
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
