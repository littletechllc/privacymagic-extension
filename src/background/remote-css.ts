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

const watchForCssRequests = () => {
  chrome.webRequest.onBeforeRequest.addListener(details => {
    console.log('css request:', details)
    return { cancel: false }
  }, { urls: ['<all_urls>'], types: ['stylesheet'] })
}

const handleRemoteCssRequests = async (): Promise<void> => {
  watchForCssRequests()
  await setupRemoteCssRules()
}

export { handleRemoteCssRequests }
