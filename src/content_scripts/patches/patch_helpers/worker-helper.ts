import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { resolveAbsoluteUrl } from '@src/content_scripts/helpers/safe'
import { getTrustedTypePolicyForObject, makeTrustedScriptURLFunction } from '@src/content_scripts/helpers/trusted-types'
import { enableBlobLockingAndCaching } from './blob-locking'
import { WorkerScriptURL } from './worker-types'

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

/**
 * Make a sanitized script for a worker. Returns a blob URL
 * in the form of a string or a TrustedScriptURL.
 * If the URL is a blob URL, a completion callback is added to the script
 * to unlock the blob URL when the script finishes importing. The same
 * callback is registered on `error` / `unhandledrejection` so a throw in
 * the imported or inlined worker still unlocks (and is not swallowed, so
 * the parent Worker `error` event can fire).
 * @returns {string | TrustedScriptURL}
 */
export const makeSanitizedScriptForWorker = ({
  url,
  options,
  globalObject,
  hardeningCode,
}: {
  url: WorkerScriptURL
  options: WorkerOptions | string | undefined
  globalObject: GlobalScope
  hardeningCode: string
}): string | TrustedScriptURL => {
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
  const importCommand = typeof options === 'object' && options?.type === 'module'
    ? 'await import'
    : 'importScripts'
  const unlockOnErrorCode = completionCallbackCode === ''
    ? ''
    : `
          ;(() => {
            const complete = () => {
              ${completionCallbackCode}
            };
            self.addEventListener("error", complete, { once: true });
            self.addEventListener("unhandledrejection", complete, { once: true });
          })();`
  // Semicolon separated code to avoid issues with line continuations.
  const prefix = `
          ;self.__PRIVACY_MAGIC_WORKER_URL__ = ${jsonStringifySafe(absoluteUrl)}
          ${unlockOnErrorCode}
          ;${hardeningCode}
          ;`
  const suffix = `
          ;${completionCallbackCode}`
  let payload: string | Blob | undefined = getCachedBlob(absoluteUrl)
  if (payload == null) {
    // Do not catch: an uncaught worker error must reach Worker `onerror`
    // (sites such as hls.js fall back to main-thread work on that event).
    payload = `
            const trustedAbsoluteUrl = (${makeTrustedScriptURLFunction.toString()})(self, ${policyNameString}, ${jsonStringifySafe(absoluteUrl)});
            ${importCommand}(trustedAbsoluteUrl);
          `
  }
  const blobUrl = URLSafe.createObjectURL(new BlobSafe([prefix, payload, suffix], { type: 'text/javascript' }))
  const sanitizedBlobUrl = policy ? policy.createScriptURL(blobUrl) : blobUrl
  return sanitizedBlobUrl
}
