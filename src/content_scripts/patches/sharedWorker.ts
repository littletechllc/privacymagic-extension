import type { GlobalScope } from "@src/content_scripts/helpers/globalObject"
import type { ContentSettingId } from '@src/common/setting-ids'
import { createSafeGetter, createSafeMethod } from "@src/content_scripts/helpers/monkey-patch"
import { makeSanitizedScriptForWorker } from "./patch_helpers/worker-helper"
import { makeBundleForInjection, getDisabledSettings } from "../helpers/helpers"
import { resolveAbsoluteUrl } from "../helpers/safe"
import type { SharedWorkerConstructor, WorkerScriptURL } from "./patch_helpers/worker-types"
import { getTrustedTypePolicyForObject, prepareInjectionForTrustedTypes } from "../helpers/trusted-types"

export type SharedWorkerPatchDeps = {
  makeBundleForInjection?: (disabledSettings: string[]) => string
  getDisabledSettings?: () => ContentSettingId[]
  prepareInjectionForTrustedTypes?: (globalObject: GlobalScope, hardeningCode: string) => void
}

const sharedWorker = (globalObject: GlobalScope, deps?: SharedWorkerPatchDeps): void => {
  if (globalObject.SharedWorker === undefined) {
    return
  }
  const makeBundle = deps?.makeBundleForInjection ?? makeBundleForInjection
  const getDisabled = deps?.getDisabledSettings ?? getDisabledSettings
  const prepareTrustedTypesInjection = deps?.prepareInjectionForTrustedTypes ?? prepareInjectionForTrustedTypes

  const SafeXMLHttpRequest = globalObject.XMLHttpRequest
  const safeXhrOpen = createSafeMethod(SafeXMLHttpRequest, 'open')
  const safeXhrSend = createSafeMethod(SafeXMLHttpRequest, 'send')
  const safeXhrStatus = createSafeGetter(SafeXMLHttpRequest, 'status')

  const isBlobUrlAlive = (url: string): boolean => {
    try {
      const xhr = new SafeXMLHttpRequest()
      safeXhrOpen(xhr, 'HEAD', url, false)
      safeXhrSend(xhr)
      return safeXhrStatus(xhr) === 200
    } catch {
      return false
    }
  }

  const hardeningCode = makeBundle(getDisabled())
  prepareTrustedTypesInjection(globalObject, hardeningCode)

  const getOrCreateHardenedUrlForSharedWorker = (url: string | URL | TrustedScriptURL, options: WorkerOptions | string | undefined): string | TrustedScriptURL => {
    const absoluteUrl = resolveAbsoluteUrl(url.toString(), globalObject.location.href)
    const name = typeof options === 'string' ? options : options?.name
    const workerType = typeof options === 'string' ? 'classic' : (options?.type ?? 'classic')
    const KEY = `--privacy-magic-sw:${absoluteUrl}:${workerType}${name ? `:${name}` : ''}--`
    const stored = globalObject.localStorage.getItem(KEY)
    if (stored != null && isBlobUrlAlive(stored)) {
      if (globalObject.TrustedScriptURL != null && url instanceof globalObject.TrustedScriptURL) {
        const policy = getTrustedTypePolicyForObject(url)
        if (policy) {
          return policy.createScriptURL(stored)
        }
      }
      return stored
    }
    const sanitizedBlobUrl = makeSanitizedScriptForWorker({
      url, options, globalObject, hardeningCode
    })
    globalObject.localStorage.setItem(KEY, sanitizedBlobUrl.toString())
    return sanitizedBlobUrl
  }

  globalObject.SharedWorker = new Proxy(globalObject.SharedWorker, {
    construct(Target: SharedWorkerConstructor, [url, options]: [WorkerScriptURL, WorkerOptions | string | undefined]) {
      if (url.toString().startsWith('chrome:') || url.toString().startsWith('chrome-extension:')) {
        return new Target(url, options)
      }
      const hardenedUrl = getOrCreateHardenedUrlForSharedWorker(url, options)
      return new Target(hardenedUrl, options)
    }
  })
}

export default sharedWorker