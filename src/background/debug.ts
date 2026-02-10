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

export const testHttpBehavior = (): void => {
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
