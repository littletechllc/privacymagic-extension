import { handleAsync } from '../common/util'
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
  chrome.webRequest.onBeforeRequest.addListener((details) => {
    handleAsync(async () => {
      console.log('css request:', details)
    }, (error: unknown) => {
      console.error('error watching for css requests:', error)
    })
    return undefined
  }, { urls: ['<all_urls>'], types: ['stylesheet'] })
}

const handleRemoteCssRequests = async (): Promise<void> => {
  await watchForCssRequests()
  await setupRemoteCssRules()
}

export { handleRemoteCssRequests }
