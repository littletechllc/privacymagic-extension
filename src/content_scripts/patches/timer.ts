import { redefinePropertyValues, reflectApplySafe, objectDefinePropertiesSafe, nonProperty } from '../helpers';

const timer = () => {
  const mathRoundSafe = Math.round;
  const originalNow = Object.getOwnPropertyDescriptor(Performance.prototype, 'now')!.value;
  const restoreNow = redefinePropertyValues(Performance.prototype, {
    now: function () { return mathRoundSafe(reflectApplySafe(originalNow, this, [])); }
  });
  const objectKeysSafe = Object.keys;
  const objectFromEntriesSafe = Object.fromEntries;
  const arrayMapValue = Object.getOwnPropertyDescriptor(Array.prototype, 'map')!.value;
  const arrayMapSafe = (array: any[], callback: (value: any, index: number, array: any[]) => any) => reflectApplySafe(arrayMapValue, array, [callback]);
  const getPropertyValueSafe = (object: any, property: string) => {  
    try {
      return object[property];
    } catch (error) {
      return undefined;
    }
  };
  const makeRoundedGetters = (objectPrototype: any, properties: string[]) => {
    const originalDescriptors: PropertyDescriptorMap = {};
    for (const property of properties) {
      const descriptor = Object.getOwnPropertyDescriptor(objectPrototype, property);
      originalDescriptors[property] = descriptor ?? nonProperty;
      if (descriptor) {
        const originalGetter = descriptor.get!;
        descriptor.get = function (...args) { return mathRoundSafe(reflectApplySafe(originalGetter, this, args)); };
        Object.defineProperty(objectPrototype, property, descriptor);
      }
    }
    const toJsonOriginalDescriptor = Object.getOwnPropertyDescriptor(objectPrototype, 'toJSON');
    if (toJsonOriginalDescriptor) {
      const toJsonOriginalValue = toJsonOriginalDescriptor.value;
      const toJsonNewDescriptor = { ...toJsonOriginalDescriptor };
      const toJsonOriginalSafe = (object: any) => reflectApplySafe(toJsonOriginalValue, object, []);
      toJsonNewDescriptor.value = function () {
        const originalJson = toJsonOriginalSafe(this);
        if (originalJson === undefined) {
          return undefined;
        }
        return objectFromEntriesSafe(arrayMapSafe(objectKeysSafe(originalJson), k => ([k, getPropertyValueSafe(this, k)])));
      };
      Object.defineProperty(objectPrototype, 'toJSON', toJsonNewDescriptor);
    }
  };

  type Constructor = { prototype: any };
  const batchMakeRoundedGetters = (objectsWithProperties: readonly [(Constructor | null | undefined), string[]][]) => {
    objectsWithProperties.map(([object, properties]) => {
      if (!object) {
        return () => {};
      }
      return makeRoundedGetters(object.prototype, properties);
    });
  };
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
  ] as const);
  return () => {
    restoreNow();
  };
};

export default timer;
