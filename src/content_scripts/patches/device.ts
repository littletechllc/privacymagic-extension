import { redefinePropertyValues } from '../helpers'

const device = (): (() => void) => {
  let restoreDevicePosture: () => void
  if (self.DevicePosture != null) {
    restoreDevicePosture = redefinePropertyValues(DevicePosture.prototype, {
      type: 'continuous',
      addEventListener: (/* ignore */) => { /* do nothing */ },
      removeEventListener: (/* ignore */) => { /* do nothing */ },
      dispatchEvent: (/* ignore */) => { /* do nothing */ },
      change: {
        get: () => { return null },
        set: (_value: unknown) => { /* do nothing */ },
        configurable: false,
        enumerable: true,
        writable: true
      }
    })
  }
  return () => {
    if (restoreDevicePosture !== undefined) {
      restoreDevicePosture()
    }
  }
}

export default device
