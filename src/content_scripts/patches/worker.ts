import type { ContentSettingId } from '@src/common/setting-ids'
import { makeBundleForInjection, getDisabledSettings } from '@src/content_scripts/helpers/helpers'
import { createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { resolveAbsoluteUrl } from '@src/content_scripts/helpers/safe'
import { getTrustedTypePolicyForObject, prepareInjectionForTrustedTypes } from '@src/content_scripts/helpers/trusted-types'
import { GlobalScope } from '../helpers/globalObject'
import { enableBlobLockingAndCaching } from './patch_helpers/blob-locking'
import { generateCompletionCallbackCode, makeTrustedScriptURLFunction } from './patch_helpers/worker-helper'

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
  const BlobSafe = globalObject.Blob
  const URLSafe = globalObject.URL
  const URLcreateObjectURLSafe = (source: Blob | MediaSource): string => URLSafe.createObjectURL(source)
  const { lockObjectUrl, unlockObjectUrl, getCachedBlob } = enableBlobLockingAndCaching(globalObject)

  const stringStartsWithSafe = createSafeMethod(String, 'startsWith')
  const jsonStringifySafe = JSON.stringify

  // Run hardening code in workers before they are executed.
  // TODO: Do we need to worry about module blobs with relative imports?
  const prepareInjectionForWorker = (hardeningCode: string): void => {
    const locationHref = globalObject.location.href
    let policy: TrustedTypePolicy | undefined
    if (globalObject.Worker == null) return
    globalObject.Worker = new Proxy(globalObject.Worker, {
      construct (Target, [url, options]: [string | URL | TrustedScriptURL, WorkerOptions?]) {
        if (url.toString().startsWith('chrome:') || url.toString().startsWith('chrome-extension:')) {
          // Don't harden chrome:// or chrome-extension:// URLs.
          return new Target(url.toString(), options)
        }
        let policyNameString: string | undefined = undefined
        if (globalObject.TrustedScriptURL != null && url instanceof globalObject.TrustedScriptURL) {
          policy = getTrustedTypePolicyForObject(url)
          policyNameString = policy ? jsonStringifySafe(policy?.name) : undefined
        }
        const absoluteUrl = resolveAbsoluteUrl(url.toString(), locationHref)
        let completionCallbackCode = ''
        if (stringStartsWithSafe(absoluteUrl, 'blob:')) {
          completionCallbackCode = generateCompletionCallbackCode(globalObject, () => {
            unlockObjectUrl(absoluteUrl)
          })
          lockObjectUrl(absoluteUrl)
        }
        options = options ?? {}
        const importCommand = ('type' in options && options.type === 'module')
          ? 'await import'
          : 'importScripts'
        // Semicolon separated code to avoid issues with line continuations.
        const prefix = `
          ;__PRIVACY_MAGIC_WORKER_URL__ = ${jsonStringifySafe(absoluteUrl)}
          ;${hardeningCode}
          ;`
        const suffix = `
          ;${completionCallbackCode}`
        let payload: string | Blob | undefined = getCachedBlob(absoluteUrl);
        if (payload == null) {
          payload = `
            const trustedAbsoluteUrl = (${makeTrustedScriptURLFunction.toString()})(self, ${policyNameString}, ${jsonStringifySafe(absoluteUrl)});
            try {
              ${importCommand}(trustedAbsoluteUrl);
              console.log("finished importing");
            } catch (error) {
              console.error("error in importing: ", error);
            }
          `;
        }
        const blobUrl = URLcreateObjectURLSafe(new BlobSafe([prefix, payload, suffix], { type: 'text/javascript' }))
        const sanitizedBlobUrl = policy ? policy.createScriptURL(blobUrl) : blobUrl
        return new Target(sanitizedBlobUrl as string, options)
      }
    })
  }

  const hardeningCode = makeBundle(getDisabled())
  prepareTrustedTypesInjection(globalObject, hardeningCode)
  prepareInjectionForWorker(hardeningCode)
}

export default worker
