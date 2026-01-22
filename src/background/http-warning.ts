import { handleAsync, logError } from '@src/common/util'
import { includeInListIfNeeded } from '@src/common/data-structures'
import { CategoryId, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
const HTTP_WARNING_URL = chrome.runtime.getURL('/privacymagic/http-warning.html')

const category: CategoryId = 'http_warnings'

const standardHttpUpgradeRule: chrome.declarativeNetRequest.Rule = {
  id: dnrRuleIdForName(category, 'standardHttpUpgradeRule'),
  action: {
    type: 'upgradeScheme'
  },
  priority: 3,
  condition: {
    regexFilter: '^http://.*',
    resourceTypes: ['main_frame']
  }
}

const specialHttpWarningRule: chrome.declarativeNetRequest.Rule = {
  id: dnrRuleIdForName(category, 'specialHttpWarningRule'),
  action: {
    type: 'redirect',
    redirect: {
      regexSubstitution: HTTP_WARNING_URL + '?url=\\0'
    }
  },
  priority: 4,
  condition: {
    regexFilter: '^http://.*',
    resourceTypes: ['main_frame'],
    requestDomains: ['dummy.domain']
  }
}

const specialHttpAllowRule: chrome.declarativeNetRequest.Rule = {
  id: dnrRuleIdForName(category, 'specialHttpAllowRule'),
  action: {
    type: 'allow'
  },
  priority: 5,
  condition: {
    regexFilter: '^http://.*',
    resourceTypes: ['main_frame'],
    requestDomains: ['dummy.domain']
  }
}

/* Here's how the https-only mode works. Note that it only applies to top-level navigations and requests.

Scenario A. The user enters or clicks on a URL with explicit http:// scheme.
            This generates an onBeforeNavigateRequest event with a url that starts with http://.
 with a url that starts with http://.
  1. The network request is upgraded to https:// by the browser
  2. The network responds with a TLS error or a redirect to an http:// URL.
  3. We replace the page with the http warning page.
Scenario B. The user enters a URL without an explicit scheme.
            This also generates an onBeforeNavigateRequest event with a url that starts with http://.
  1. A network request with https:// scheme is made.
  2. The network responds with a TLS error or a redirect to an http:// URL.
  3. We replace the page with the http warning page.
Scenario C. The user clicks on a link with an https:// scheme.
            This generates an onBeforeNavigateRequest event with a url that starts with https://.
  1. The network request is made with https:// scheme.
  2. If the network responds with a TLS error, we don't interfere (the browser will show
    the TLS error page). If the network repsonds with a redirect to an http:// URL, we replace
    the page with the http warning page.

So: the strategy is:
  If an https request is made and the network responds with a TLS error or a redirect
  to the same URL with an http:// scheme, and the domain to the http warning rule,

  If the user clicks the "Continue to site anyway" button, we add the domain to the http allow rule.

 */

const updateRule = async (rule: chrome.declarativeNetRequest.Rule): Promise<void> => {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [rule.id],
    addRules: [rule]
  })
}

const updateRuleWithDomain = async (rule: chrome.declarativeNetRequest.Rule, domain: string, protectionEnabled: boolean): Promise<void> => {
  rule.condition.requestDomains = includeInListIfNeeded<string>(rule.condition.requestDomains, domain, !protectionEnabled)
  await updateRule(rule)
}

export const updateHttpWarningNetworkRuleException = async (url: string, protectionEnabled: boolean): Promise<void> => {
  const domain = new URL(url).hostname
  if (domain === null) {
    return
  }
  await updateRuleWithDomain(specialHttpAllowRule, domain, protectionEnabled)
}

export const createHttpWarningNetworkRule = async (): Promise<void> => {
  await updateRule(standardHttpUpgradeRule)
  await updateRule(specialHttpWarningRule)
  await updateRule(specialHttpAllowRule)

  chrome.webRequest.onErrorOccurred.addListener((details) => {
    handleAsync(async () => {
      if (details.url.startsWith('https://')) {
        const domain = new URL(details.url).hostname
        if (domain === null) {
          return
        }
        await updateRuleWithDomain(specialHttpWarningRule, domain, true)
      }
    }, (error) => {
      logError(error, 'error creating HTTP warning network rule', details)
    })
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
}
