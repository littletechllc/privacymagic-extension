import { injectCssForCosmeticFilters } from './cosmetic-filters'
import { getDisabledSettings, getDomainsWhereSettingIsDisabled } from '@src/common/settings-read'
import { setUserDisabledSetting } from './settings-write'
import { resetAllPrefsToDefaults } from '@src/common/prefs'
import { logError, handleAsync } from '@src/common/util'
import { type Message, type ResponseSendFunction, type SuccessResponse, type ContentResponse, type RegistrableDomainSuccessResponse } from '@src/common/messages'
import { registrableDomainFromUrl } from './registrable-domain'
import { disableSyncSettingsDone } from './disable-sync-settings-done'
import { updateRulesForAllSettings } from './dnr/rule-manager'
import { showBlockedRequests } from './monitor-blocking'
import { startWatchingRemoteConfig } from './remote'

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
      await setUserDisabledSetting(message.domain, message.settingId, !message.value)
      sendResponse({ success: true } as SuccessResponse)
    } else if (message.type === 'getRemoteStyleSheetContent') {
      const response = await fetch(message.url, { headers: { "Content-Type": "text/css" } })
      const content = await response.text()
      sendResponse({ success: true, content } as ContentResponse)
    } else if (message.type === 'reloadTab') {
      await chrome.tabs.reload(message.tabId)
      console.log('reloaded tab', message.tabId)
      sendResponse({ success: true } as SuccessResponse)
    } else if (message.type === 'disableSyncSettingsDone') {
      await disableSyncSettingsDone(message.tabId)
      sendResponse({ success: true } as SuccessResponse)
    } else if (message.type === 'getRegistrableDomain') {
      let domain: string | null = null
      try {
        domain = registrableDomainFromUrl(message.url)
      } catch {
        domain = null
      }
      sendResponse({ success: true, domain } as RegistrableDomainSuccessResponse)
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

const removeAllServiceWorkers = async (): Promise<void> => {
  const excludedDomains = await getDomainsWhereSettingIsDisabled('serviceWorker')
  const excludeOrigins = [...excludedDomains].map(domain => `https://${domain}`)
  chrome.browsingData.removeServiceWorkers({ excludeOrigins }, () => {
    console.log('service workers removed, except for domains:', [...excludedDomains].join(', '))
  })
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
    showBlockedRequests()
    startWatchingRemoteConfig()
  } catch (error) {
    logError(error, 'error initializing listeners')
  }
}

// Functions that set up persistent resources (dynamic DNR rules persist across sessions)
const initializePersistentResources = async (): Promise<void> => {
  await blockAutocomplete()
  await updateRulesForAllSettings(await getDisabledSettings())
}

const showWelcomePage = async (): Promise<void> => {
  await chrome.tabs.create({ url: 'privacymagic/welcome.html' })
}

chrome.runtime.onInstalled.addListener((details) => {
  handleAsync(async () => {
    if (details.reason === 'install') {
      await showWelcomePage()
    }
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
void removeAllServiceWorkers()
