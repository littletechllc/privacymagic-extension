import {describe, it, expect, beforeEach} from '@jest/globals'
import timer from '@src/content_scripts/patches/timer'

// Test constants: a non-integer value used to verify rounding behavior
const TEST_FRACTIONAL_VALUE = 123.456789
const TEST_ROUNDED_VALUE = Math.round(TEST_FRACTIONAL_VALUE)

// Create mock classes if they don't exist in jsdom
if (global.PerformanceEntry == null) {
  global.PerformanceEntry = class PerformanceEntry {} as typeof PerformanceEntry
  // Add toJSON method to PerformanceEntry prototype
  PerformanceEntry.prototype.toJSON = function () {
    return {
      name: this.name,
      entryType: this.entryType,
      duration: this.duration,
      startTime: this.startTime
    }
  }
}

if (self.PerformanceResourceTiming == null) {
  self.PerformanceResourceTiming = class PerformanceResourceTiming extends PerformanceEntry {} as typeof PerformanceResourceTiming
}

if (self.PerformanceNavigationTiming == null) {
  self.PerformanceNavigationTiming = class PerformanceNavigationTiming extends PerformanceResourceTiming {} as typeof PerformanceNavigationTiming
}

if (self.LargestContentfulPaint == null) {
  self.LargestContentfulPaint = class LargestContentfulPaint extends PerformanceEntry {} as typeof LargestContentfulPaint
}

if (self.LayoutShift == null) {
  self.LayoutShift = class LayoutShift extends PerformanceEntry {} as typeof LayoutShift
}

if (self.PerformanceEventTiming == null) {
  self.PerformanceEventTiming = class PerformanceEventTiming extends PerformanceEntry {} as typeof PerformanceEventTiming
}

if (self.PerformanceLongAnimationFrameTiming == null) {
  self.PerformanceLongAnimationFrameTiming = class PerformanceLongAnimationFrameTiming extends PerformanceEntry {} as typeof PerformanceLongAnimationFrameTiming
}

if (self.PerformanceScriptTiming == null) {
  self.PerformanceScriptTiming = class PerformanceScriptTiming extends PerformanceEntry {} as typeof PerformanceScriptTiming
}

if (self.PerformanceServerTiming == null) {
  self.PerformanceServerTiming = class PerformanceServerTiming {} as typeof PerformanceServerTiming
}

// Helper function to mock a property getter to return TEST_FRACTIONAL_VALUE
function mockPropertyGetter(prototype: object, property: string): void {
  Object.defineProperty(prototype, property, {
    get: () => TEST_FRACTIONAL_VALUE,
    configurable: true,
    enumerable: true
  })
}

// Helper function to mock multiple property getters at once
function mockPropertyGetters(prototype: object, properties: string[]): void {
  for (const property of properties) {
    mockPropertyGetter(prototype, property)
  }
}

// Helper function to mock a property value to return TEST_FRACTIONAL_VALUE
function mockPropertyValue(prototype: object, property: string): void {
  Object.defineProperty(prototype, property, {
    value: () => TEST_FRACTIONAL_VALUE,
    writable: true,
    enumerable: false,
    configurable: true
  })
}

// Helper function to test multiple properties on a prototype instance
function testProperties<T>(
  patchEnabled: boolean,
  instance: T,
  properties: Array<keyof T | string>
): void {
  for (const prop of properties) {
    const propName = String(prop)
    // Test normal property access
    const value = (instance as Record<string, unknown>)[propName] as number
    if (patchEnabled) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBe(TEST_ROUNDED_VALUE)
    } else {
      expect(value).toBe(TEST_FRACTIONAL_VALUE)
      expect(Number.isInteger(value)).toBe(false)
    }
    // Test direct getter access via Object.getOwnPropertyDescriptor (simulating attacker bypass)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const prototype = Object.getPrototypeOf(instance)
    const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, propName)
    if (descriptor?.get != null) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const getter = descriptor.get as (this: T) => number
      const directValue = getter.call(instance)
      if (patchEnabled) {
        // With patch: should still be rounded even when accessed directly
        expect(Number.isInteger(directValue)).toBe(true)
        expect(directValue).toBe(TEST_ROUNDED_VALUE)
      } else {
        // Without patch: should return fractional value
        expect(directValue).toBe(TEST_FRACTIONAL_VALUE)
        expect(Number.isInteger(directValue)).toBe(false)
      }
    }
  }
}

describe.each([
  { patchEnabled: false, description: 'without patch' },
  { patchEnabled: true, description: 'with patch enabled' }
])('timer patch - $description', ({ patchEnabled }) => {
  let mockPerformanceEntry: PerformanceEntry

  beforeEach(() => {
    // Mock all Performance APIs to return fractional values BEFORE applying patch
    // This ensures the patch wraps our mock functions
    mockPropertyValue(Performance.prototype, 'now')
    mockPropertyGetter(Performance.prototype, 'timeOrigin')

    // Mock PerformanceEntry properties
    mockPropertyGetters(PerformanceEntry.prototype, ['duration', 'startTime'])

    // Mock PerformanceResourceTiming properties
    mockPropertyGetters(PerformanceResourceTiming.prototype, [
      'connectEnd',
      'connectStart',
      'domainLookupEnd',
      'domainLookupStart',
      'fetchStart',
      'finalResponseHeadersStart',
      'firstInterimResponseEnd',
      'firstInterimResponseStart',
      'redirectEnd',
      'redirectStart',
      'requestStart',
      'responseEnd',
      'responseStart',
      'secureConnectionStart',
      'workerStart'
    ])

    // Mock PerformanceNavigationTiming properties
    mockPropertyGetters(PerformanceNavigationTiming.prototype, [
      'activationStart',
      'criticalCHRestart',
      'domComplete',
      'domContentLoadedEventEnd',
      'domContentLoadedEventStart',
      'domInteractive',
      'loadEventEnd',
      'loadEventStart',
      'unloadEventEnd',
      'unloadEventStart'
    ])

    // Mock PerformanceEventTiming properties
    mockPropertyGetters(PerformanceEventTiming.prototype, ['processingEnd', 'processingStart'])

    // Mock PerformanceLongAnimationFrameTiming properties
    mockPropertyGetters(PerformanceLongAnimationFrameTiming.prototype, [
      'blockingDuration',
      'firstUIEventTimestamp',
      'renderStart',
      'styleAndLayoutStart'
    ])

    // Mock PerformanceScriptTiming properties
    mockPropertyGetters(PerformanceScriptTiming.prototype, [
      'executionStart',
      'forcedStyleAndLayoutDuration',
      'pauseDuration'
    ])

    // Mock PerformanceServerTiming properties
    mockPropertyGetters(PerformanceServerTiming.prototype, ['duration'])

    // Mock LargestContentfulPaint properties
    mockPropertyGetters(LargestContentfulPaint.prototype, ['loadTime', 'renderTime'])

    // Mock LayoutShift properties
    mockPropertyGetters(LayoutShift.prototype, ['lastInputTime'])

    // Create a mock PerformanceEntry for toJSON() test
    mockPerformanceEntry = Object.create(PerformanceEntry.prototype) as PerformanceEntry
    Object.defineProperty(mockPerformanceEntry, 'name', {
      value: 'test-entry',
      configurable: true,
      enumerable: true
    })
    Object.defineProperty(mockPerformanceEntry, 'entryType', {
      value: 'measure',
      configurable: true,
      enumerable: true
    })

    if (patchEnabled) {
      timer()
    }
  })

  it('should handle Performance.now() values', () => {
    const now = performance.now()
    if (patchEnabled) {
      expect(Number.isInteger(now)).toBe(true)
      expect(now).toBe(TEST_ROUNDED_VALUE)
    } else {
      expect(now).toBe(TEST_FRACTIONAL_VALUE)
      expect(Number.isInteger(now)).toBe(false)
    }
  })

  it('should handle Performance.timeOrigin values', () => {
    testProperties(patchEnabled, performance, ['timeOrigin'])
  })

  it('should handle PerformanceEntry properties', () => {
    const entry = Object.create(PerformanceEntry.prototype) as PerformanceEntry
    testProperties(patchEnabled, entry, ['duration', 'startTime'])
  })

  it('should handle PerformanceResourceTiming properties', () => {
    const timing = Object.create(PerformanceResourceTiming.prototype) as PerformanceResourceTiming
    testProperties(patchEnabled, timing, [
      'connectEnd',
      'connectStart',
      'domainLookupEnd',
      'domainLookupStart',
      'fetchStart',
      'finalResponseHeadersStart',
      'firstInterimResponseEnd',
      'firstInterimResponseStart',
      'redirectEnd',
      'redirectStart',
      'requestStart',
      'responseEnd',
      'responseStart',
      'secureConnectionStart',
      'workerStart'
    ])
  })

  it('should handle PerformanceNavigationTiming properties', () => {
    const timing = Object.create(PerformanceNavigationTiming.prototype) as PerformanceNavigationTiming
    testProperties(patchEnabled, timing, [
      'activationStart',
      'criticalCHRestart',
      'domComplete',
      'domContentLoadedEventEnd',
      'domContentLoadedEventStart',
      'domInteractive',
      'loadEventEnd',
      'loadEventStart',
      'unloadEventEnd',
      'unloadEventStart'
    ])
  })

  it('should handle toJSON() output values', () => {
    const json = mockPerformanceEntry.toJSON() as Record<string, unknown>
    expect(json).toBeDefined()
    if (json != null && typeof json === 'object') {
      testProperties(patchEnabled, json, ['duration', 'startTime'])
    }
  })

  it('should handle LargestContentfulPaint properties', () => {
    const lcp = Object.create(LargestContentfulPaint.prototype) as LargestContentfulPaint
    testProperties(patchEnabled, lcp, ['loadTime', 'renderTime'])
  })

  it('should handle LayoutShift properties', () => {
    const shift = Object.create(LayoutShift.prototype) as LayoutShift
    testProperties(patchEnabled, shift, ['lastInputTime'])
  })

  it('should handle PerformanceEventTiming properties', () => {
    const timing = Object.create(PerformanceEventTiming.prototype) as PerformanceEventTiming
    testProperties(patchEnabled, timing, ['processingEnd', 'processingStart'])
  })

  it('should handle PerformanceLongAnimationFrameTiming properties', () => {
    const timing = Object.create(PerformanceLongAnimationFrameTiming.prototype) as PerformanceLongAnimationFrameTiming
    testProperties(patchEnabled, timing, [
      'blockingDuration',
      'firstUIEventTimestamp',
      'renderStart',
      'styleAndLayoutStart'
    ])
  })

  it('should handle PerformanceScriptTiming properties', () => {
    const timing = Object.create(PerformanceScriptTiming.prototype) as PerformanceScriptTiming
    testProperties(patchEnabled, timing, [
      'executionStart',
      'forcedStyleAndLayoutDuration',
      'pauseDuration'
    ])
  })

  it('should handle PerformanceServerTiming properties', () => {
    const timing = Object.create(PerformanceServerTiming.prototype) as PerformanceServerTiming
    testProperties(patchEnabled, timing, ['duration'])
  })
})
