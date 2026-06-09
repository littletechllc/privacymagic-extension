import type { ContentSettingId } from '@src/common/setting-ids'
import { makeBundleForInjection, getDisabledSettings } from '@src/content_scripts/helpers/helpers'
import { prepareInjectionForTrustedTypes } from '@src/content_scripts/helpers/trusted-types'
import { GlobalScope } from '../helpers/globalObject'
import { makeSanitizedBlobForWorker } from './patch_helpers/worker-helper'
import type { WorkerConstructor } from './patch_helpers/worker-types'

/** Optional overrides for tests (avoids `makeBundleForInjection` needing esbuild’s `__PRIVACY_MAGIC_INJECT__`). */
export type WorkerPatchDeps = {
  makeBundleForInjection?: (disabledSettings: string[]) => string
  getDisabledSettings?: () => ContentSettingId[]
  prepareInjectionForTrustedTypes?: (globalObject: GlobalScope, hardeningCode: string) => void
}

const worker = (globalObject: GlobalScope, deps?: WorkerPatchDeps): void => {
  const makeBundle = deps?.makeBundleForInjection ?? makeBundleForInjection
  const getDisabled = deps?.getDisabledSettings ?? getDisabledSettings
  const prepareTrustedTypesInjection = deps?.prepareInjectionForTrustedTypes ?? prepareInjectionForTrustedTypes
  // Run hardening code in workers before they are executed.
  // TODO: Do we need to worry about module blobs with relative imports?
  const prepareInjectionForWorker = (hardeningCode: string): void => {
    if (globalObject.Worker == null) return
    globalObject.Worker = new Proxy(globalObject.Worker, {
      construct (Target: WorkerConstructor, [url, options]: [string | URL | TrustedScriptURL, WorkerOptions?]) {
        if (url.toString().startsWith('chrome:') || url.toString().startsWith('chrome-extension:')) {
          // Don't harden chrome:// or chrome-extension:// URLs.
          return new Target(url.toString(), options)
        }
        const sanitizedBlobUrl = makeSanitizedBlobForWorker({
          url,
          options,
          globalObject,
          hardeningCode,
        })
        return new Target(sanitizedBlobUrl, options)
      }
    })
  }

  const hardeningCode = makeBundle(getDisabled())
  prepareTrustedTypesInjection(globalObject, hardeningCode)
  prepareInjectionForWorker(hardeningCode)
}

export default worker
