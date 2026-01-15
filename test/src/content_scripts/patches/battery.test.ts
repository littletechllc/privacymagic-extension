import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import battery from '../../../../src/content_scripts/patches/battery'

// Mock BatteryManager class
class MockBatteryManager {
  charging = false
  chargingTime = 3600
  dischargingTime = 7200
  level = 0.75
  addEventListener = (_type: string, _listener: EventListener) => {}
  removeEventListener = (_type: string, _listener: EventListener) => {}
  dispatchEvent = (_event: Event) => false
  onchargingchange: ((this: MockBatteryManager, ev: Event) => unknown) | null = null
  onchargingtimechange: ((this: MockBatteryManager, ev: Event) => unknown) | null = null
  ondischargingtimechange: ((this: MockBatteryManager, ev: Event) => unknown) | null = null
  onlevelchange: ((this: MockBatteryManager, ev: Event) => unknown) | null = null
}

// Type helper for accessing BatteryManager on self
type SelfWithBatteryManager = typeof globalThis & { BatteryManager?: typeof MockBatteryManager }

describe('battery patch', () => {
  let originalBatteryManager: typeof MockBatteryManager | undefined

  beforeEach(() => {
    // Store original BatteryManager if it exists
    const selfWithBattery = self as SelfWithBatteryManager
    originalBatteryManager = selfWithBattery.BatteryManager

    // Mock BatteryManager in self scope (matches the patch implementation)
    selfWithBattery.BatteryManager = MockBatteryManager

    // Mock navigator.getBattery to return a new instance
    const navigatorWithBattery = global.navigator as typeof global.navigator & {
      getBattery: () => Promise<MockBatteryManager>
    }
    navigatorWithBattery.getBattery = jest.fn<() => Promise<MockBatteryManager>>().mockImplementation(() => Promise.resolve(new MockBatteryManager()))
  })

  afterEach(() => {
    // Restore original BatteryManager if it existed
    if (originalBatteryManager !== undefined) {
      ;(self as SelfWithBatteryManager).BatteryManager = originalBatteryManager
    } else {
      delete (self as SelfWithBatteryManager).BatteryManager
    }
  })

  describe('without patch', () => {
    it('should return original battery values', () => {
      const batteryInstance = new MockBatteryManager()

      expect(batteryInstance.charging).toBe(false)
      expect(batteryInstance.chargingTime).toBe(3600)
      expect(batteryInstance.dischargingTime).toBe(7200)
      expect(batteryInstance.level).toBe(0.75)
    })

    it('should allow setting event handlers', () => {
      const batteryInstance = new MockBatteryManager()
      const handler = jest.fn()

      batteryInstance.onchargingchange = handler
      expect(batteryInstance.onchargingchange).toBe(handler)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      // Apply the patch
      battery()
    })

    it('should return patched charging value (true)', () => {
      const batteryInstance = new MockBatteryManager()

      expect(batteryInstance.charging).toBe(true)
    })

    it('should return patched chargingTime value (0)', () => {
      const batteryInstance = new MockBatteryManager()

      expect(batteryInstance.chargingTime).toBe(0)
    })

    it('should return patched dischargingTime value (Infinity)', () => {
      const batteryInstance = new MockBatteryManager()

      expect(batteryInstance.dischargingTime).toBe(Infinity)
    })

    it('should return patched level value (1)', () => {
      const batteryInstance = new MockBatteryManager()

      expect(batteryInstance.level).toBe(1)
    })

    it('should silence event handlers (return null)', () => {
      const batteryInstance = new MockBatteryManager()

      expect(batteryInstance.onchargingchange).toBe(null)
      expect(batteryInstance.onchargingtimechange).toBe(null)
      expect(batteryInstance.ondischargingtimechange).toBe(null)
      expect(batteryInstance.onlevelchange).toBe(null)
    })

    it('should prevent setting event handlers', () => {
      const batteryInstance = new MockBatteryManager()
      const handler = jest.fn()

      batteryInstance.onchargingchange = handler
      // Setting should not throw, but getter should still return null
      expect(batteryInstance.onchargingchange).toBe(null)
    })

    it('should have no-op event listener methods', () => {
      const batteryInstance = new MockBatteryManager()
      const handler = jest.fn()

      // These should not throw
      expect(() => {
        batteryInstance.addEventListener('chargingchange', handler)
      }).not.toThrow()

      expect(() => {
        batteryInstance.removeEventListener('chargingchange', handler)
      }).not.toThrow()

      expect(() => {
        batteryInstance.dispatchEvent(new Event('chargingchange'))
      }).not.toThrow()
    })

    it('should work with navigator.getBattery()', async () => {
      const navigatorWithBattery = navigator as typeof navigator & {
        getBattery: () => Promise<MockBatteryManager>
      }
      const batteryInstance = await navigatorWithBattery.getBattery()

      expect(batteryInstance.charging).toBe(true)
      expect(batteryInstance.chargingTime).toBe(0)
      expect(batteryInstance.dischargingTime).toBe(Infinity)
      expect(batteryInstance.level).toBe(1)
    })
  })

  describe('when BatteryManager is not available', () => {
    beforeEach(() => {
      // Remove BatteryManager
      delete (self as SelfWithBatteryManager).BatteryManager
    })

    it('should not throw when patch is applied', () => {
      expect(() => {
        battery()
      }).not.toThrow()
    })
  })
})
