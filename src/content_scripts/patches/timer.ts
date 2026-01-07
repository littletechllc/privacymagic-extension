import { redefinePropertyValues, reflectApplySafe, nonProperty } from '../helpers'

const timer = (): void => {
  const mathRoundSafe = Math.round
  const nowDescriptor = Object.getOwnPropertyDescriptor(Performance.prototype, 'now')
  if (nowDescriptor?.value === undefined) {
    throw new Error('Performance.now not found')
  }
  const originalNow = nowDescriptor.value
  redefinePropertyValues(Performance.prototype, {
    now: function () { return mathRoundSafe(reflectApplySafe(originalNow, this, [])) }
  })
  const objectKeysSafe = Object.keys
  const objectFromEntriesSafe = Object.fromEntries
  const mapDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  if (mapDescriptor?.value === undefined) {
    throw new Error('Array.prototype.map not found')
  }
  const arrayMapValue = mapDescriptor.value
  const arrayMapSafe = (array: any[], callback: (value: any, index: number, array: any[]) => any): any[] => reflectApplySafe(arrayMapValue, array, [callback])
  const getPropertyValueSafe = (object: any, property: string): any => {
    try {
      return object[property]
    } catch {
      return undefined
    }
  }
  const makeRoundedGetters = (objectPrototype: any, properties: string[]): void => {
    const originalDescriptors: PropertyDescriptorMap = {}
    for (const property of properties) {
      const descriptor = Object.getOwnPropertyDescriptor(objectPrototype, property)
      originalDescriptors[property] = descriptor ?? nonProperty
      if (descriptor?.get !== undefined) {
        const originalGetter = descriptor.get
        descriptor.get = function (...args) { return mathRoundSafe(reflectApplySafe(originalGetter, this, args)) }
        Object.defineProperty(objectPrototype, property, descriptor)
      }
    }
    const toJsonOriginalDescriptor = Object.getOwnPropertyDescriptor(objectPrototype, 'toJSON')
    if (toJsonOriginalDescriptor != null) {
      const toJsonOriginalValue = toJsonOriginalDescriptor.value
      const toJsonNewDescriptor = { ...toJsonOriginalDescriptor }
      const toJsonOriginalSafe = (object: any): any => reflectApplySafe(toJsonOriginalValue, object, [])
      toJsonNewDescriptor.value = function () {
        const originalJson = toJsonOriginalSafe(this)
        if (originalJson === undefined) {
          return undefined
        }
        return objectFromEntriesSafe(arrayMapSafe(objectKeysSafe(originalJson), k => ([k, getPropertyValueSafe(this, k)])))
      }
      Object.defineProperty(objectPrototype, 'toJSON', toJsonNewDescriptor)
    }
  }

  interface Constructor { prototype: any }
  const batchMakeRoundedGetters = (objectsWithProperties: ReadonlyArray<[(Constructor | null | undefined), string[]]>): void => {
    objectsWithProperties.forEach(([object, properties]) => {
      if (object !== null && object !== undefined) {
        makeRoundedGetters(object.prototype, properties)
      }
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const restorePerformance = batchMakeRoundedGetters([
    [self.Performance, ['timeOrigin']],
    [self.PerformanceEntry, ['duration', 'startTime']],
    [self.LargestContentfulPaint, ['loadTime', 'renderTime']],
    [self.LayoutShift, ['lastInputTime']],
    [self.PerformanceEventTiming, ['processingEnd', 'processingStart']],
    [self.PerformanceLongAnimationFrameTiming, [
      'blockingDuration',
      'firstUIEventTimestamp',
      'renderStart',
      'styleAndLayoutStart'
    ]],
    [self.PerformanceLongTaskTiming, []],
    [self.PerformanceResourceTiming, [
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
    ]],
    [self.PerformanceNavigationTiming, [
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
    ]],
    [self.PerformanceScriptTiming, [
      'executionStart',
      'forcedStyleAndLayoutDuration',
      'pauseDuration'
    ]],
    [self.PerformanceServerTiming, ['duration']]
  ] as const)
}

export default timer
