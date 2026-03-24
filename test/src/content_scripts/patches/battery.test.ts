import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import battery from '@src/content_scripts/patches/battery'

// Mock BatteryManager class
class MockBatteryManager {
  get charging() { return false }
  get chargingTime() { return 3600 }
  get dischargingTime() { return 7200 }
  get level() { return 0.75 }
  addEventListener(_type: string, _listener: EventListener): void {}
  removeEventListener(_type: string, _listener: EventListener): void {}
  dispatchEvent(_event: Event): boolean { return false }
  onchargingchange_ : ((this: MockBatteryManager, ev: Event) => unknown) | null = null
  get onchargingchange() { return this.onchargingchange_ }
  set onchargingchange(value: ((this: MockBatteryManager, ev: Event) => unknown) | null) { this.onchargingchange_ = value }
  onchargingtimechange_ : ((this: MockBatteryManager, ev: Event) => unknown) | null = null
  get onchargingtimechange() { return this.onchargingtimechange_ }
  set onchargingtimechange(value: ((this: MockBatteryManager, ev: Event) => unknown) | null) { this.onchargingtimechange_ = value }
  ondischargingtimechange_ : ((this: MockBatteryManager, ev: Event) => unknown) | null = null
  get ondischargingtimechange() { return this.ondischargingtimechange_ }
  set ondischargingtimechange(value: ((this: MockBatteryManager, ev: Event) => unknown) | null) { this.ondischargingtimechange_ = value }
  onlevelchange_ : ((this: MockBatteryManager, ev: Event) => unknown) | null = null
  get onlevelchange() { return this.onlevelchange_ }
  set onlevelchange(value: ((this: MockBatteryManager, ev: Event) => unknown) | null) { this.onlevelchange_ = value }
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
      battery(self)
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
        battery(self)
      }).not.toThrow()
    })
  })
})
