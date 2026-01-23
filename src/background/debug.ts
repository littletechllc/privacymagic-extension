// Debug utilities for development

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const logMatchingRulesInDevMode = (): void => {
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
export const testHttpBehavior = (): void => {
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
