export {}

declare global {

  class BatteryManager extends EventTarget {
    charging: boolean
    chargingTime: number
    dischargingTime: number
    level: number
  }

  class DevicePosture extends EventTarget {
    readonly type: string
  }

  class LayoutShift extends PerformanceEntry {
    readonly lastInputTime: number
  }

  type HighEntropyValues = {
    brands: Array<{ brand: string, version: string }>
    mobile: boolean
    platform: string
    architecture?: string
    bitness?: string
    formFactors?: string[]
    fullVersionList?: Array<{ brand: string, version: string }>
    model?: string
    platformVersion?: string
    uaFullVersion?: string
    wow64?: boolean
  }

  type HighEntropyHint = 'architecture' | 'bitness' | 'brands' | 'formFactors' | 'fullVersionList' | 'mobile' | 'model' | 'platform' | 'platformVersion' | 'uaFullVersion' | 'wow64'

  class NavigatorUAData extends EventTarget {
    readonly brands: Array<{ brand: string, version: string }>
    readonly mobile: boolean
    readonly platform: string
    getHighEntropyValues: (hints: HighEntropyHint[]) => Promise<HighEntropyValues>
    toJSON: {
      brands: Array<{ brand: string, version: string }>
      mobile: boolean
      platform: string
    }
  }

  class PerformanceLongAnimationFrameTiming extends PerformanceEntry {
    blockingDuration: number
    firstUIEventTimestamp: number
    renderStart: number
    styleAndLayoutStart: number
  }

  class PerformanceLongTaskTiming extends PerformanceEntry {
    duration: number
    startTime: number
  }

  class PerformanceScriptTiming extends PerformanceEntry {
    executionStart: number
    forcedStyleAndLayoutDuration: number
    pauseDuration: number
  }

  class SharedStorage extends EventTarget {
    has: (key: string) => boolean
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    delete: (key: string) => void
    clear: () => void
  }

  class TrustedHTML {
    toJSON: () => string
    toString: () => string
  }

  class TrustedScript extends String {
    toJSON: () => string
    toString: () => string
  }

  class TrustedScriptURL {
    toJSON: () => string
    toString: () => string
  }

  class TrustedTypePolicy {
    name: string
    createHTML: (input: string | TrustedHTML) => TrustedHTML
    createScript: (input: string | TrustedScript) => TrustedScript
    createScriptURL: (input: string | TrustedScriptURL) => TrustedScriptURL
  }

  type TrustedTypePolicyOptions = {
    createHTML?: (input: string | TrustedHTML) => string | TrustedHTML
    createScript?: (input: string | TrustedScript) => string | TrustedScript
    createScriptURL?: (input: string | TrustedScriptURL) => string | TrustedScriptURL
  }

  class TrustedTypePolicyFactory {
    createPolicy: (policyName: string, policyOptions: TrustedTypePolicyOptions) => TrustedTypePolicy
  }

  interface Window {
    BatteryManager?: typeof BatteryManager
    DevicePosture?: typeof DevicePosture
    LayoutShift?: typeof LayoutShift
    PerformanceLongAnimationFrameTiming?: typeof PerformanceLongAnimationFrameTiming
    PerformanceLongTaskTiming?: typeof PerformanceLongTaskTiming
    PerformanceScriptTiming?: typeof PerformanceScriptTiming
    NavigatorUAData?: typeof NavigatorUAData
    SharedStorage?: typeof SharedStorage
    eval?: (code: string | TrustedScript) => unknown
    trustedTypes?: TrustedTypePolicyFactory
  }

  interface WorkerGlobalScope {
    trustedTypes?: TrustedTypePolicyFactory
  }

  interface Navigator {
    userAgentData?: NavigatorUAData
  }

  interface Uint8ArrayConstructor {
    fromBase64: (base64: string) => Uint8Array<ArrayBuffer>
  }

  interface FontFaceSet {
    add(font: FontFace): void
    clear(): void
    delete(font: FontFace): void
  }
}
