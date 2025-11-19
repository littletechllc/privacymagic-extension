/* global chrome */

import { addIfMissing, removeIfPresent } from '../common/util.js';

const HTTP_WARNING_MAIN_RULE_ID = 300;

export const updateHttpWarningNetworkRuleException = async (domain, value) => {
  console.log('updating http warning network rule exception for domain:', domain, 'value:', value);
  const rules = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: [HTTP_WARNING_MAIN_RULE_ID]
  });
  console.log('rules:', rules);
  if (rules.length === 0) {
    return;
  }
  const rule = rules[0];
  const excludedRequestDomains = rule.condition.excludedRequestDomains || [];
  console.log('excludedRequestDomains:', excludedRequestDomains);
  if (value === false || value === 'exception') {
    addIfMissing(excludedRequestDomains, domain);
  } else {
    removeIfPresent(excludedRequestDomains, domain);
  }
  rule.condition.excludedRequestDomains = excludedRequestDomains;
  console.log('new http warning main rule:', rule);
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] });
  const rules2 = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: [HTTP_WARNING_MAIN_RULE_ID]
  });
  console.log('rules2:', rules2);
};

export const createHttpWarningNetworkRule = async () => {
  const httpWarningUrl = chrome.runtime.getURL('/privacymagic/http-warning.html');
  const mainRule = {
    id: HTTP_WARNING_MAIN_RULE_ID,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: httpWarningUrl + '?url=\\0'
      }
    },
    priority: 3,
    condition: {
      regexFilter: '^http://.*',
      resourceTypes: ['main_frame']
    }
  };
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [HTTP_WARNING_MAIN_RULE_ID],
    addRules: [mainRule]
  });

  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
      (callback) => {
        console.log('rule matched debug:', callback);
      }
    );
  }
};
