/* global chrome */

const HTTP_WARNING_MAIN_RULE_ID = 300;
const HTTP_WARNING_EXCEPTION_RULE_ID = 301;

export const updateHttpWarningNetworkRuleException = async (domain, value) => {
  console.log('updating http warning network rule exception for domain:', domain, 'value:', value);
  const rules = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: [HTTP_WARNING_EXCEPTION_RULE_ID]
  });
  console.log('rules:', rules);
  if (rules.length === 0) {
    return;
  }
  const rule = rules[0];
  const requestDomains = rule.condition.requestDomains || [];
  console.log('requestDomains:', requestDomains);
  if (value === false || value === "exception") {
    if (!requestDomains.includes(domain)) {
      requestDomains.push(domain);
    }
  } else {
    if (requestDomains.includes(domain)) {
      requestDomains.splice(requestDomains.indexOf(domain), 1);
    }
  }
  rule.condition.requestDomains = requestDomains;
  console.log('new rule:', rule);
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] });
  const rules2 = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: [HTTP_WARNING_EXCEPTION_RULE_ID]
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
  const exceptionRule = {
    id: HTTP_WARNING_EXCEPTION_RULE_ID,
    priority: 3,
    action: {
      type: 'allow'
    },
    condition: {
      requestDomains: ['dummy'],
      resourceTypes: ['main_frame']
    }
  };
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [HTTP_WARNING_MAIN_RULE_ID, HTTP_WARNING_EXCEPTION_RULE_ID],
    addRules: [mainRule, exceptionRule]
  });

  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
      (callback) => {
        console.log('rule matched debug:', callback);
      }
    );
  }
};
