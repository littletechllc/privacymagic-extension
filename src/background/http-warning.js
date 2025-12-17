/* global chrome */

import { addIfMissing, removeIfPresent } from '../common/util.js';

const HTTP_WARNING_MAIN_RULE_ID = 300;
const HTTP_WARNING_URL = chrome.runtime.getURL('/privacymagic/http-warning.html');

/** @type {chrome.declarativeNetRequest.Rule} */
const mainRule = {
  id: HTTP_WARNING_MAIN_RULE_ID,
  action: {
    type: 'redirect',
    redirect: {
      regexSubstitution: HTTP_WARNING_URL + '?url=\\0'
    }
  },
  priority: 3,
  condition: {
    regexFilter: '^http://.*',
    resourceTypes: ['main_frame']
  }
};

const updateMainRule = async () => {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [HTTP_WARNING_MAIN_RULE_ID],
    addRules: [mainRule]
  });
};

export const updateHttpWarningNetworkRuleException = async (domain, value) => {
  console.log('updating http warning network rule exception for domain:', domain, 'value:', value);
  const excludedRequestDomains = mainRule.condition.excludedRequestDomains || [];
  if (value === false || value === 'exception') {
    addIfMissing(excludedRequestDomains, domain);
  } else {
    removeIfPresent(excludedRequestDomains, domain);
  }
  mainRule.condition.excludedRequestDomains = excludedRequestDomains;
  await updateMainRule();
};

export const createHttpWarningNetworkRule = async () => {
  await updateMainRule();

  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
      (callback) => {
        console.log('rule matched debug:', callback);
      }
    );
  }
};
