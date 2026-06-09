import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { resolveAbsoluteUrl } from '@src/content_scripts/helpers/safe'
import { getTrustedTypePolicyForObject, makeTrustedScriptURLFunction } from '@src/content_scripts/helpers/trusted-types'
import { enableBlobLockingAndCaching } from './blob-locking'

export const generateCompletionCallbackCode = (
  globalObject: GlobalScope,
  callback: () => void
): string => {
  const completionType = 'completion'
  const broadcastChannelName = '--privacy-magic-completion--' + globalObject.crypto.randomUUID()
  const BroadcastChannelConstructor = globalObject.BroadcastChannel
  if (BroadcastChannelConstructor == null) throw new Error('BroadcastChannel not available')
  const broadcastChannel = new BroadcastChannelConstructor(broadcastChannelName)
  broadcastChannel.onmessage = (message: MessageEvent) => {
    const data = message?.data as { type: string } | null
    if (data?.type === completionType) {
      callback()
    }
  }
  return `(() => {
      const broadcastChannel = new BroadcastChannel(${JSON.stringify(broadcastChannelName)});
      broadcastChannel.postMessage({ type: ${JSON.stringify(completionType)} });
    })();`
}

export type MakeSanitizedBlobDeps = {
  globalObject: GlobalScope
  hardeningCode: string
}

export type SanitizedBlobResult = {
  sanitizedBlobUrl: string | TrustedScriptURL
  options: WorkerOptions
}

export const makeSanitizedBlob = (
  url: string | URL | TrustedScriptURL,
  options: WorkerOptions | undefined,
  deps: MakeSanitizedBlobDeps
): SanitizedBlobResult => {
  const { globalObject, hardeningCode } = deps
  const { lockObjectUrl, unlockObjectUrl, getCachedBlob } = enableBlobLockingAndCaching(globalObject)
  const BlobSafe = globalObject.Blob
  const URLSafe = globalObject.URL
  const stringStartsWithSafe = createSafeMethod(String, 'startsWith')
  const jsonStringifySafe = JSON.stringify

  let policy: TrustedTypePolicy | undefined
  let policyNameString: string | undefined
  if (globalObject.TrustedScriptURL != null && url instanceof globalObject.TrustedScriptURL) {
    policy = getTrustedTypePolicyForObject(url)
    policyNameString = policy ? jsonStringifySafe(policy.name) : undefined
  }
  const absoluteUrl = resolveAbsoluteUrl(url.toString(), globalObject.location.href)
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
  let payload: string | Blob | undefined = getCachedBlob(absoluteUrl)
  if (payload == null) {
    payload = `
            const trustedAbsoluteUrl = (${makeTrustedScriptURLFunction.toString()})(self, ${policyNameString}, ${jsonStringifySafe(absoluteUrl)});
            try {
              ${importCommand}(trustedAbsoluteUrl);
              console.log("finished importing");
            } catch (error) {
              console.error("error in importing: ", error);
            }
          `
  }
  const blobUrl = URLSafe.createObjectURL(new BlobSafe([prefix, payload, suffix], { type: 'text/javascript' }))
  const sanitizedBlobUrl = policy ? policy.createScriptURL(blobUrl) : blobUrl
  return { sanitizedBlobUrl, options }
}
