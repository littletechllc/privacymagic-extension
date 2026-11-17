import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import memory from '@src/content_scripts/patches/memory'
import { defineMockProperties } from '@test/mocks/define'

const mockDeviceMemory = 8
const LEAKY_JS_HEAP_SIZE_LIMIT = 3858759680
const JS_HEAP_SIZE_LIMIT_MACOS = 4395630592
const JS_HEAP_SIZE_LIMIT_WINDOWS_LINUX = 4294705152

type NavWithUAData = { userAgentData?: { platform: string } | null }

class MockMemoryInfo {
  get jsHeapSizeLimit (): number {
    return LEAKY_JS_HEAP_SIZE_LIMIT
  }

  get totalJSHeapSize (): number {
    return 10000000
  }

  get usedJSHeapSize (): number {
    return 5000000
  }
}

const installMockPerformanceMemory = (): void => {
  Object.defineProperty(performance, 'memory', {
    configurable: true,
    enumerable: true,
    get: () => new MockMemoryInfo()
  })
}

const removeMockPerformanceMemory = (): void => {
  Reflect.deleteProperty(performance, 'memory')
}

describe('memory patch', () => {
  let originalUserAgentData: NavWithUAData['userAgentData']

  beforeEach(() => {
    const nav = navigator as NavWithUAData
    originalUserAgentData = nav.userAgentData
  })

  afterEach(() => {
    const nav = navigator as NavWithUAData
    if (originalUserAgentData === undefined) {
      Reflect.deleteProperty(nav, 'userAgentData')
    } else {
      nav.userAgentData = originalUserAgentData
    }
    removeMockPerformanceMemory()
  })

  describe('when deviceMemory exists', () => {
    beforeEach(() => {
      // Match `redefineNavigatorFields`: own props on `Navigator.prototype` (not the `navigator` instance).
      defineMockProperties(self.Navigator.prototype, { deviceMemory: mockDeviceMemory })
    })

    describe('without patch', () => {
      it('should return original deviceMemory', () => {
        expect((navigator as { deviceMemory?: number }).deviceMemory).toBe(mockDeviceMemory)
      })
    })

    describe('with patch enabled', () => {
      beforeEach(() => {
        memory(self)
      })

      it('should set deviceMemory to undefined', () => {
        expect((navigator as { deviceMemory?: number }).deviceMemory).toBeUndefined()
      })
    })
  })

  describe('when deviceMemory is absent', () => {
    beforeEach(() => {
      Reflect.deleteProperty(self.Navigator.prototype, 'deviceMemory')
    })

    it('should no-op deviceMemory without throwing', () => {
      expect('deviceMemory' in navigator).toBe(false)
      expect(() => memory(self)).not.toThrow()
      expect('deviceMemory' in navigator).toBe(false)
    })
  })

  describe('jsHeapSizeLimit', () => {
    beforeEach(() => {
      installMockPerformanceMemory()
    })

    describe('without patch', () => {
      it('should return the original jsHeapSizeLimit', () => {
        expect(performance.memory?.jsHeapSizeLimit).toBe(LEAKY_JS_HEAP_SIZE_LIMIT)
      })
    })

    describe('with patch enabled', () => {
      it.each([
        ['macOS', JS_HEAP_SIZE_LIMIT_MACOS],
        ['Windows', JS_HEAP_SIZE_LIMIT_WINDOWS_LINUX],
        ['Linux', JS_HEAP_SIZE_LIMIT_WINDOWS_LINUX],
        ['ChromeOS', JS_HEAP_SIZE_LIMIT_WINDOWS_LINUX]
      ] as const)('should spoof jsHeapSizeLimit on %s', (platform, expected) => {
        ;(navigator as NavWithUAData).userAgentData = { platform }
        memory(self)
        expect(performance.memory?.jsHeapSizeLimit).toBe(expected)
      })
    })

    describe('when performance.memory is absent', () => {
      it('should no-op without throwing', () => {
        removeMockPerformanceMemory()
        expect(performance.memory).toBeUndefined()
        expect(() => memory(self)).not.toThrow()
      })
    })
  })
})
