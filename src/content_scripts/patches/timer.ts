import { redefineMethods, reflectApplySafe, nonProperty, createSafeMethod, type MethodOf } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const timer = (globalObject: GlobalScope): void => {
  const mathRoundSafe = Math.round
  if (globalObject.Performance === undefined) return
  const nowDescriptor = Object.getOwnPropertyDescriptor(globalObject.Performance.prototype, 'now')
  if (nowDescriptor?.value === undefined) {
    throw new Error('Performance.now not found')
  }
  const originalNow = nowDescriptor.value as (this: Performance) => number
  redefineMethods(globalObject.Performance.prototype, {
    now: function (this: Performance) {
      return mathRoundSafe(reflectApplySafe(originalNow, this, []))
    }
  })
  const objectKeysSafe = Object.keys
  const objectFromEntriesSafe = Object.fromEntries
  const mapDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  if (mapDescriptor?.value === undefined) {
    throw new Error('Array.prototype.map not found')
  }
  const arrayMapValue = mapDescriptor.value as <T, U>(this: T[], callback: (value: T, index: number, array: T[]) => U) => U[]
  const arrayMapSafe = <T, U>(array: T[], callback: (value: T, index: number, array: T[]) => U): U[] => {
    return reflectApplySafe(
      arrayMapValue as MethodOf<T[]>,
      array,
      [callback] as unknown as Parameters<MethodOf<T[]>>
    ) as U[]
  }
  const getPropertyValueSafe = <T, K extends keyof T>(object: T, property: K): T[K] | undefined => {
    try {
      return object[property]
    } catch {
      return undefined
    }
  }

  type performanceAPI = { prototype: PerformanceEntry | Performance | PerformanceServerTiming  }

  const makeRoundedGetters = (apiObject: performanceAPI, properties: string[]): void => {
    const originalDescriptors: PropertyDescriptorMap = {}
    for (const property of properties) {
      const descriptor = Object.getOwnPropertyDescriptor(apiObject.prototype, property)
      originalDescriptors[property] = descriptor ?? nonProperty
      if (descriptor?.get === undefined) {
        continue
      }
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const originalGetter = descriptor.get
      Object.defineProperty(apiObject.prototype, property, {
        ...descriptor,
        get: function (this: performanceAPI['prototype']) {
          const result = reflectApplySafe(originalGetter as (this: performanceAPI['prototype']) => number, this, [])
          return mathRoundSafe(Number(result))
        }
      })
    }
    const toJsonOriginalDescriptor = Object.getOwnPropertyDescriptor(apiObject.prototype, 'toJSON')
    if (toJsonOriginalDescriptor != null) {
      const toJsonOriginalValue = createSafeMethod(apiObject, 'toJSON')
      const toJsonNewDescriptor = { ...toJsonOriginalDescriptor }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toJsonNewDescriptor.value = function (this: performanceAPI['prototype']) : any {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const originalJson = toJsonOriginalValue(this)
        if (originalJson == null || typeof originalJson !== 'object') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return originalJson
        }
        const jsonObject = originalJson as Record<string, unknown>
        return objectFromEntriesSafe(arrayMapSafe(objectKeysSafe(jsonObject), k => ([k, getPropertyValueSafe(this, k as keyof typeof this)])))
      }
      Object.defineProperty(apiObject.prototype, 'toJSON', toJsonNewDescriptor)
    }
  }

  const batchMakeRoundedGetters = (objectsWithProperties: ReadonlyArray<[performanceAPI | undefined, string[]]>): void => {
    objectsWithProperties.forEach(([object, properties]) => {
      if (object != null) {
        makeRoundedGetters(object, properties)
      }
    })
  }
  batchMakeRoundedGetters([
    [globalObject.Performance, ['timeOrigin']],
    [globalObject.PerformanceEntry, ['duration', 'startTime']],
    [globalObject.LargestContentfulPaint, ['loadTime', 'renderTime']],
    [globalObject.LayoutShift, ['lastInputTime']],
    [globalObject.PerformanceEventTiming, ['processingEnd', 'processingStart']],
    [globalObject.PerformanceLongAnimationFrameTiming, [
      'blockingDuration',
      'firstUIEventTimestamp',
      'renderStart',
      'styleAndLayoutStart'
    ]],
    [globalObject.PerformanceLongTaskTiming, []],
    [globalObject.PerformanceResourceTiming, [
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
    [globalObject.PerformanceNavigationTiming, [
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
    [globalObject.PerformanceScriptTiming, [
      'executionStart',
      'forcedStyleAndLayoutDuration',
      'pauseDuration'
    ]],
    [globalObject.PerformanceServerTiming, ['duration']]
  ] as const)
}

export default timer
