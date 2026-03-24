import {describe, it, expect, beforeAll, beforeEach} from '@jest/globals'
import device from '@src/content_scripts/patches/device'
import { defineMockProperties } from '@test/mocks/define'

const leakyType = 'folded'
const unpatchedMessage = 'DevicePosture unpatched'
const unpatchedError = (): Error => new Error(unpatchedMessage)

/**
 * Runtime `extends EventTarget` (jsdom has no `DevicePosture` constructor).
 * `implements DevicePosture` links the class to the global type from `window-extensions.d.ts`.
 */
class DevicePostureMock extends EventTarget implements DevicePosture {
  readonly type: string
  onchange: ((this: DevicePosture, ev: Event) => unknown) | null
  constructor() {
    super()
    this.type = 'folded'
    this.onchange = () => { throw new Error('onchange not implemented') }
  }
}

/** Baseline prototype before `device()`; runs each test so `device()` mutations don’t leak across tests. */
function seedDevicePosturePrototype (): void {
  const proto = self.DevicePosture!.prototype
  defineMockProperties(proto, {
    type: leakyType,
    onchange: null,
    addEventListener: function (_type: string, _listener: EventListenerOrEventListenerObject): void {
      throw unpatchedError()
    },
    removeEventListener: function (_type: string, _listener: EventListenerOrEventListenerObject): void {
      throw unpatchedError()
    },
    dispatchEvent: function (_event: Event): boolean {
      throw unpatchedError()
    }
  })
}

describe('device patch', () => {
  /** Once per suite: env must not ship `DevicePosture`; then install the mock for the whole file. */
  beforeAll(() => {
    const w = self as Window & { DevicePosture?: typeof DevicePosture }
    expect(w.DevicePosture).toBeUndefined()
    w.DevicePosture = DevicePostureMock as unknown as typeof DevicePosture
  })

  beforeEach(() => {
    seedDevicePosturePrototype()
    const posture = Object.create(self.DevicePosture!.prototype) as DevicePosture
    defineMockProperties(self.navigator, { devicePosture: posture })
  })

  // Unpatched cases first: nested `with patch` runs `device()` after seed.
  describe('without patch', () => {
    it('should leak DevicePosture type and change', () => {
      const posture = self.navigator.devicePosture!
      expect(posture.type).toBe(leakyType)
      expect(posture.onchange).toBeNull()
    })

    it('should throw from addEventListener (unpatched vs patched no-op)', () => {
      const posture = self.navigator.devicePosture!
      expect(() => {
        posture.addEventListener('change', () => {})
      }).toThrow(unpatchedMessage)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      device(self)
    })

    it('should spoof type to continuous', () => {
      expect(self.navigator.devicePosture!.type).toBe('continuous')
    })

    it('should set onchange to null', () => {
      expect(self.navigator.devicePosture!.onchange).toBeNull()
    })

    it('should no-op addEventListener', () => {
      expect(() => {
        self.navigator.devicePosture!.addEventListener('change', () => {})
      }).not.toThrow()
    })
  })
})
