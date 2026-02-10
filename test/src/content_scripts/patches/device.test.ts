import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import device from '@src/content_scripts/patches/device'

const leakyType = 'folded'
const leakyChange = 'folded'

class MockDevicePosture {
  type = leakyType
  addEventListener = (_type: string, _listener: EventListenerOrEventListenerObject): void => {}
  removeEventListener = (_type: string, _listener: EventListenerOrEventListenerObject): void => {}
  dispatchEvent = (_event: Event): boolean => false
  get change(): { posture: string } | null {
    return { posture: leakyChange }
  }
}

type SelfWithDevicePosture = { DevicePosture?: typeof MockDevicePosture }

describe('device patch', () => {
  let originalDevicePosture: typeof MockDevicePosture | undefined

  beforeEach(() => {
    const selfWith = self as unknown as SelfWithDevicePosture
    originalDevicePosture = selfWith.DevicePosture
    selfWith.DevicePosture = MockDevicePosture
  })

  afterEach(() => {
    const selfWith = self as unknown as SelfWithDevicePosture
    if (originalDevicePosture !== undefined) {
      selfWith.DevicePosture = originalDevicePosture
    } else {
      delete selfWith.DevicePosture
    }
  })

  describe('without patch', () => {
    it('should leak DevicePosture type and change', () => {
      const posture = new MockDevicePosture()
      expect(posture.type).toBe(leakyType)
      expect(posture.change).not.toBeNull()
      expect(posture.change?.posture).toBe(leakyChange)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      device()
    })

    it('should spoof type to continuous', () => {
      const posture = new (self as unknown as SelfWithDevicePosture).DevicePosture!()
      expect(posture.type).toBe('continuous')
    })

    it('should spoof change to null', () => {
      const posture = new (self as unknown as SelfWithDevicePosture).DevicePosture!()
      // redefinePropertyValues wraps the descriptor as the value; the getter inside it returns null
      const changeDesc = posture.change as { get?: () => unknown }
      expect(typeof changeDesc.get).toBe('function')
      expect(changeDesc.get!()).toBeNull()
    })

    it('should no-op addEventListener', () => {
      const posture = new (self as unknown as SelfWithDevicePosture).DevicePosture!()
      expect(() => posture.addEventListener('change', () => {})).not.toThrow()
    })
  })
})
