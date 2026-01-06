import { IDS } from './ids'

const setupRemoteCssRules = async (): Promise<void> => {
  return await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [IDS.REMOTE_CSS_BLOCK_RULE_ID],
    addRules: [
      {
        id: IDS.REMOTE_CSS_BLOCK_RULE_ID,
        priority: 10,
        action: {
          type: 'block'
        },
        condition: {
          resourceTypes: ['stylesheet']
        }
      }
    ]
  })
}

const watchForCssRequests = async (): Promise<void> => {
  const listener = (details: chrome.webRequest.OnBeforeRequestDetails): { cancel: boolean } => {
    console.log('css request:', details)
    return {}
  }
  chrome.webRequest.onBeforeRequest.addListener(listener, { urls: ['<all_urls>'], types: ['stylesheet'] })
}

const handleRemoteCssRequests = async (): Promise<void> => {
  await watchForCssRequests()
  await setupRemoteCssRules()
}

export { handleRemoteCssRequests }
