import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

const device = (): void => {
  if (self.DevicePosture != null) {
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
