import { redefineNavigatorFields, redefinePrototypeFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'
import { getOperatingSystem } from './patch_helpers/operating-system'

// Common Chromium desktop buckets after MemoryInfo quantization.
const JS_HEAP_SIZE_LIMIT_MACOS = 4395630592
const JS_HEAP_SIZE_LIMIT_WINDOWS_LINUX = 4294705152

const memory = (globalObject: GlobalScope): void => {
  // Chromium-only; Firefox has no navigator.deviceMemory.
  if ('deviceMemory' in globalObject.navigator) {
    redefineNavigatorFields(globalObject, {
      // Cover Your Tracks: 1 in 1.93 browsers have this value:
      deviceMemory: undefined
    })
  }

  const memoryInfo = globalObject.performance.memory
  if (memoryInfo != null) {
    const jsHeapSizeLimit = getOperatingSystem() === 'macOS'
      ? JS_HEAP_SIZE_LIMIT_MACOS
      : JS_HEAP_SIZE_LIMIT_WINDOWS_LINUX
    // Patch the unexposed MemoryInfo.prototype via the instance.
    redefinePrototypeFields({ prototype: Object.getPrototypeOf(memoryInfo) as MemoryInfo }, {
      jsHeapSizeLimit
    })
  }
}

export default memory
