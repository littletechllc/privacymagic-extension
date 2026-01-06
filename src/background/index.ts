import { injectCssForCosmeticFilters } from './cosmetic-filters'
import { updateContentScripts, setupContentScripts } from './content-scripts'
import { setSetting } from '../common/settings'
import { setupNetworkRules, updateTopLevelNetworkRule } from './network'
import { resetAllPrefsToDefaults } from '../common/prefs'
/* eslint-disable no-unused-vars, import/no-unused-modules */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createHttpWarningNetworkRule, updateHttpWarningNetworkRuleException } from './http-warning'
import { adjustExceptionToStaticRules, setupExceptionsToStaticRules } from './blocker-exceptions'
import { handleRemoteCssRequests } from './remote-css'
import { logError, registrableDomainFromUrl, handleAsync } from '../common/util'
import { SettingsId } from '../common/settings-ids'

const blockAutocomplete = async (): Promise<void> => {
  await chrome.declarativeNetRequest.updateSessionRules({
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

const updateSetting = async (domain: string, settingId: SettingsId, value: boolean): Promise<void> => {
  await setSetting(domain, settingId, value)
  if (settingId === 'ads') {
    await adjustExceptionToStaticRules(domain, value)
  }
  await updateContentScripts(domain, settingId, value)
  await updateTopLevelNetworkRule(domain, settingId, value)
}

type ResponseSendFunction = (response: any) => void

const handleMessage = async (message: any, sender: chrome.runtime.MessageSender, sendResponse: ResponseSendFunction): Promise<void> => {
  try {
    if (message.type === 'updateSetting') {
      await updateSetting(message.domain, message.settingId, message.value)
      sendResponse({ success: true })
    } else if (message.type === 'addHttpWarningNetworkRuleException') {
      await updateHttpWarningNetworkRuleException(message.url, message.value)
      sendResponse({ success: true })
    } else if (message.type === 'getRemoteStyleSheetContent') {
      const response = await fetch(message.href)
      const content = await response.text()
      sendResponse({ success: true, content })
    } else if (message.type === 'getDomainForCurrentTab') {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      const url = tab.url ?? ''
      const domain = registrableDomainFromUrl(url)
      if (domain === null) {
        sendResponse({ success: false, error: 'Failed to get domain for current tab' })
        return
      }
      sendResponse({ success: true, domain })
    } else {
      throw new Error(`unknown message type: ${String(message?.type)}`)
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
  void handleMessage(message, sender, sendResponse)
  // Return true to indicate that handleMessage will send a response asynchronously.
  return true
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logMatchingRulesInDevMode = (): void => {
  if (chrome.declarativeNetRequest.onRuleMatchedDebug !== undefined) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
      (async ({ request, rule }) => {
        let ruleContent
        if (rule.rulesetId === '_session') {
          const rules = await chrome.declarativeNetRequest.getSessionRules({
            ruleIds: [rule.ruleId]
          })
          ruleContent = rules[0]
        }
        if (rule.rulesetId === '_dynamic') {
          const rules = await chrome.declarativeNetRequest.getDynamicRules({
            ruleIds: [rule.ruleId]
          })
          ruleContent = rules[0]
        }
        console.log('rule matched debug:', { request, rule, ruleContent })
      }) as (info: chrome.declarativeNetRequest.MatchedRuleInfoDebug) => void
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const testHttpBehavior = async (): Promise<void> => {
  chrome.webRequest.onBeforeRequest.addListener((details) => {
    console.log('onBeforeRequest debug:', details)
    return { cancel: false }
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    console.log('onBeforeSendHeaders debug:', details)
    return { cancel: false }
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onSendHeaders.addListener((details) => {
    console.log('onSendHeaders debug:', details)
    return { cancel: false }
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onHeadersReceived.addListener((details) => {
    console.log('onHeadersReceived debug:', details)
    return { cancel: false }
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onAuthRequired.addListener((details) => {
    console.log('onAuthRequired debug:', details)
    return { cancel: false }
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onBeforeRedirect.addListener((details) => {
    console.log('onBeforeRedirect debug:', details)
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onResponseStarted.addListener((details) => {
    console.log('onResponseStarted debug:', details)
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onCompleted.addListener((details) => {
    console.log('onCompleted debug:', details)
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webRequest.onErrorOccurred.addListener((details) => {
    console.log('onErrorOccurred debug:', details)
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    console.log('onBeforeNavigate debug:', details)
  })
  chrome.webNavigation.onCommitted.addListener((details) => {
    console.log('onCommitted debug:', details)
  })
  chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
    console.log('onDOMContentLoaded debug:', details)
  })
  chrome.webNavigation.onCompleted.addListener((details) => {
    console.log('onCompleted debug:', details)
  })
  chrome.webNavigation.onErrorOccurred.addListener((details) => {
    console.log('onErrorOccurred debug:', details)
  })
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    console.log('onHistoryStateUpdated debug:', details)
  })
  chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
    console.log('onReferenceFragmentUpdated debug:', details)
  })
}

const clearRules = async (): Promise<void> => {
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules()
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: sessionRules.map(rule => rule.id)
  })
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules()
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: dynamicRules.map(rule => rule.id)
  })
  console.log('cleared rules')
}

const initializeExtension = async (): Promise<void> => {
  await clearRules()
  injectCssForCosmeticFilters()
  await setupContentScripts()
  await setupNetworkRules()
  await setupExceptionsToStaticRules()
  // await createHttpWarningNetworkRule();
  await blockAutocomplete()
  await handleRemoteCssRequests()
  // ignore-unused-vars
  // logMatchingRulesInDevMode();
  // ignore-unused-vars
  // await testHttpBehavior();
  console.log('Extension initialized')
}

chrome.runtime.onInstalled.addListener((details) => {
  handleAsync(async () => {
    console.log('onInstalled details:', details)
    await resetAllPrefsToDefaults()
    await initializeExtension()
  }, (error) => {
    // TODO: Show user a notification that the extension failed to install.
    logError(error, 'error onInstalled', details)
  })
})

chrome.runtime.onStartup.addListener(() => {
  handleAsync(async () => {
    console.log('onStartup')
    await initializeExtension()
  }, (error) => {
    // TODO: Show user a notification that the extension failed to start.
    logError(error, 'error onStartup')
  })
})

initializeExtension().then(() => {
  console.log('background script loaded')
}).catch((error) => {
  logError(error, 'error initializing extension')
})
