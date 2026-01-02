export {};

declare global {

  class BatteryManager extends EventTarget {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
  }

  class DevicePosture extends EventTarget {
    readonly type: string;
  }

  class LayoutShift extends PerformanceEntry {
    readonly lastInputTime: number;
  }

  class NavigatorUAData extends EventTarget {
    readonly brands: { brand: string; version: string }[];
    readonly mobile: boolean;
    readonly platform: string;
    getHighEntropyValues: () => Promise<{ architecture: string; bitness: string; brands: { brand: string; version: string }[]; formFactors: string[]; fullVersionList: { brand: string; version: string }[]; mobile: boolean; model: string; platform: string; platformVersion: string; uaFullVersion: string; wow64: boolean }>;
    toJSON: () => {};
  }

  class PerformanceLongAnimationFrameTiming extends PerformanceEntry {
    blockingDuration: number;
    firstUIEventTimestamp: number;
    renderStart: number;
    styleAndLayoutStart: number;
  }

  class PerformanceLongTaskTiming extends PerformanceEntry {
    duration: number;
    startTime: number;
  }

  class PerformanceScriptTiming extends PerformanceEntry {
    executionStart: number;
    forcedStyleAndLayoutDuration: number;
    pauseDuration: number;
  }

  class SharedStorage extends EventTarget {
    has: (key: string) => boolean;
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    delete: (key: string) => void;
    clear: () => void;
  }

  interface TrustedTypePolicy {
    createHTML: (input: string) => string;
    createScript: (input: string) => string;
    createScriptURL: (input: string) => string;
  }

  interface TrustedTypePolicyFactory {
    createPolicy: (name: string, policy: {
      createHTML?: (input: string) => string;
      createScript?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    }) => TrustedTypePolicy;
  }

  interface Window {
    BatteryManager?: typeof BatteryManager;
    DevicePosture?: typeof DevicePosture;
    LayoutShift?: typeof LayoutShift;
    PerformanceLongAnimationFrameTiming?: typeof PerformanceLongAnimationFrameTiming;
    PerformanceLongTaskTiming?: typeof PerformanceLongTaskTiming;
    PerformanceScriptTiming?: typeof PerformanceScriptTiming;
    NavigatorUAData?: typeof NavigatorUAData;
    SharedStorage?: typeof SharedStorage;
    trustedTypes?: TrustedTypePolicyFactory;
  }

  interface WorkerGlobalScope {
    trustedTypes?: TrustedTypePolicyFactory;
  }

  interface Navigator {
    userAgentData?: NavigatorUAData;
  }
}
