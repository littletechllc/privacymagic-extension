import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'

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
