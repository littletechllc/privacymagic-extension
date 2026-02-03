import { injectCssForCosmeticFilters } from './cosmetic-filters'
import { setSetting } from '@src/common/settings'
import { resetAllPrefsToDefaults } from '@src/common/prefs'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createHttpWarningNetworkRule, updateHttpWarningNetworkRuleException } from './http-warning'
import { logError, registrableDomainFromUrl, handleAsync } from '@src/common/util'
import { type Message, type ResponseSendFunction, type SuccessResponse, type DomainResponse, type ContentResponse, type ErrorResponse } from '@src/common/messages'
import { updateRules, setupRules } from './dnr/rule-manager'

const blockAutocomplete = async (): Promise<void> => {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [400],
    addRules: [
      {
        id: 400,
        action: { type: 'block' },
        condition: {
          urlFilter: 'https://www.google.com/complete/*'
        }
      }
    ]
  })
}

const handleMessage = async (
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: ResponseSendFunction): Promise<void> => {
  try {
    if (message.type === 'updateSetting') {
      await setSetting(message.domain, message.settingId, message.value)
      await updateRules(message.domain, message.settingId, message.value)
      sendResponse({ success: true } as SuccessResponse)
    } else if (message.type === 'addHttpWarningNetworkRuleException') {
      await updateHttpWarningNetworkRuleException(message.url, message.value)
      sendResponse({ success: true } as SuccessResponse)
    } else if (message.type === 'getRemoteStyleSheetContent') {
      const response = await fetch(message.url, { headers: { "Content-Type": "text/css" } })
      const content = await response.text()
      sendResponse({ success: true, content } as ContentResponse)
    } else if (message.type === 'getDomainForTab') {
      const tabId = message.tabId
      const tab = await chrome.tabs.get(tabId)
      if (tab == null) {
        sendResponse({ success: false, error: 'tab not found' } as ErrorResponse)
        return
      }
      const url = tab.url ?? ''
      const domain = registrableDomainFromUrl(url)
      if (domain === null) {
        sendResponse({ success: false, error: 'Failed to get domain for current tab' } as ErrorResponse)
        return
      }
      sendResponse({ success: true, domain } as DomainResponse)
    } else if (message.type === 'reloadTab') {
      await chrome.tabs.reload(message.tabId)
      console.log('reloaded tab', message.tabId)
      sendResponse({ success: true } as SuccessResponse)
    } else {
      // Exhaustive check: all message types should be handled above
      // If this code runs, a new message type was added but not handled
      const _exhaustive: never = message
      throw new Error(`unknown message type: ${JSON.stringify(_exhaustive)}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      logError(error, 'error handling message', message)
      sendResponse({ success: false, error: error.message })
    } else {
      logError(new Error('unknown error'), 'error handling message', message)
      sendResponse({ success: false, error: 'unknown error' })
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Asynchronously handle the message. We ignore the returned Promise of handleMessage.
  void handleMessage(message as Message, sender, sendResponse)
  // Return true to indicate that handleMessage will send a response asynchronously.
  return true
})

// Functions that set up event listeners (need to be re-registered on every background script load)
const initializeListeners = (): void => {
  try {
    injectCssForCosmeticFilters()
    // Debug functions available in debug.ts:
    // import { logMatchingRulesInDevMode, testHttpBehavior } from './debug'
    // logMatchingRulesInDevMode()
    // testHttpBehavior()
  } catch (error) {
    logError(error, 'error initializing listeners')
  }
}

// Functions that set up persistent resources (dynamic DNR rules persist across sessions)
const initializePersistentResources = async (): Promise<void> => {
  await blockAutocomplete()
  await setupRules()
  // await createHttpWarningNetworkRule()
}

chrome.runtime.onInstalled.addListener((details) => {
  handleAsync(async () => {
    console.log('onInstalled details:', details)
    // Reset prefs to defaults on install/update
    // TODO: only reset prefs on first install
    await resetAllPrefsToDefaults()
    // Set up persistent resources (dynamic rules persist, but ensure they're correct on install/update)
    await initializePersistentResources()
  }, (error) => {
    // TODO: Show user a notification that the extension failed to install.
    logError(error, 'error onInstalled', details)
  })
})

chrome.runtime.onStartup.addListener(() => {
  console.log('onStartup')
})

initializeListeners()