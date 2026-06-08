import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'

/**
 * Create a function that will make a trusted script URL from a policy name and a URL.
 * This function is serialized and injected into the worker context.
 */
export const makeTrustedScriptURLFunction = (
  workerGlobal: Pick<GlobalScope, 'trustedTypes'>,
  policyName: string | undefined,
  url: string
): TrustedScriptURL | string => {
  if (policyName == null) {
    policyName = 'default'
  }
  if (workerGlobal.trustedTypes == null) {
    return url
  }
  const dummyPolicy = workerGlobal.trustedTypes.createPolicy(policyName, {
    createScriptURL: (url) => {
      return url
    }
  })
  return dummyPolicy.createScriptURL(url)
}

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
