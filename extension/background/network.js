/* global chrome */

import { getAllSettings, getSetting } from '../common/settings.js';
import { logError, registrableDomainFromUrl, getDnrIdForKey, deepCopy , SUBRESOURCE_RULE_PREFIX, TOP_LEVEL_RULE_PREFIX } from '../common/util.js';

const setHeaders = (headers) =>
  Object.entries(headers).map(
    ([header, value]) => ({ operation: 'set', header, value }));

const removeHeaders = (list) =>
  list.map(header => ({ operation: 'remove', header }));

const NETWORK_PROTECTION_DEFS = {
  gpc: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { operation: 'set', header: 'Sec-GPC', value: '1' }
      ]
    }
  }],
  useragent: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: setHeaders({
        'Sec-CH-UA-Arch': 'arm',
        'Sec-CH-UA-Bitness': '64',
        'Sec-CH-UA-Form-Factors-List': 'Desktop',
        'Sec-CH-UA-Form-Factors': 'Desktop',
        'Sec-CH-UA-Full-Version-List': 'Google Chrome;v="141.0.0.0", Not?A_Brand;v="8.0.0.0", Chromium;v="141.0.0.0"',
        'Sec-CH-UA-Full-Version': '141.0.0.0'
      })
    }
  }],
  queryParameters: [{
    action: {
      type: 'redirect',
      redirect: {
        transform: {
          queryTransform: {
            removeParams: [
              '__hsfp',
              '__hssc',
              '__hstc',
              '__s',
              '_hsenc',
              '_openstat',
              'dclid',
              'fbclid',
              'gclid',
              'hsCtaTracking',
              'mc_eid',
              'mkt_tok',
              'ml_subscriber',
              'ml_subscriber_hash',
              'msclkid',
              'oly_anon_id',
              'oly_enc_id',
              'rb_clickid',
              's_cid',
              'vero_conv',
              'vero_id',
              'wickedid',
              'yclid'
            ]
          }
        }
      }
    }
  }],
  clientHints: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Device-Memory',
        'Downlink',
        'DPR',
        'ECT',
        'RTT',
        'Sec-CH-Device-Memory',
        'Sec-CH-DPR',
        'Sec-CH-ECT',
        'Sec-CH-Prefers-Color-Scheme',
        'Sec-CH-Prefers-Reduced-Motion',
        'Sec-CH-Prefers-Reduced-Transparency',
        'Sec-CH-UA-Form-Factors',
        'Sec-CH-Viewport-Height',
        'Sec-CH-Viewport-Width',
        'Viewport-Width'
      ])
    }
  }],
  referrerPolicy: [{
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'set',
        header: 'referrer-policy',
        value: 'strict-origin-when-cross-origin'
      }]
    },
    condition: {
      excludedResponseHeaders: [{
        header: 'referrer-policy',
        values: ['no-referrer', 'origin', 'same-origin', 'strict-origin']
      }]
    }
  }, {
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'set',
        header: 'referrer-policy',
        value: 'strict-origin'
      }]
    },
    condition: {
      responseHeaders: [{
        header: 'referrer-policy',
        values: ['origin']
      }]
    }
  }]
};

const createPartialRules = (type, condition) => {
  const newRules = [];
  for (const [settingId, rules] of Object.entries(NETWORK_PROTECTION_DEFS)) {
    let i = 0;
    for (const rule of rules) {
      const newRule = deepCopy(rule);
      newRule.stringId = `${type}_${settingId}_${i}`;
      newRule.priority = 5;
      newRule.condition = {
        ...newRule.condition,
        ...condition
      };
      newRules.push(newRule);
      i++;
    }
  }
  return newRules;
};

const rulesWithIntegerIds = (rulesWithStringIds) => {
  return rulesWithStringIds.map(rule => {
    const { stringId, ...rest } = rule;
    return { ...rest, id: getDnrIdForKey(stringId) };
  });
};

const updateSessionRules = async (rules) => {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules
  });
};

const relevantStringIds = new Set();

const getSessionRulesForSetting = async (type, settingId) => {
  const ids = [...relevantStringIds]
    .filter(stringId => stringId.startsWith(`${type}_${settingId}`))
    .map(stringId => getDnrIdForKey(stringId));
  return await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: ids
  });
};

// Add an item to an array if it is not present.
const addIfMissing = (array, item) => {
  if (!array.includes(item)) {
    array.push(item);
  }
};

// Remove an item from an array if it is present.
const removeIfPresent = (array, item) => {
  const index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
  }
};

// Add or remove a domain from the excluded request domains for the top level network rule.
export const updateTopLevelNetworkRule = async (domain, settingId, value) => {
  if (!(settingId in NETWORK_PROTECTION_DEFS)) {
    return;
  }
  const rules = await getSessionRulesForSetting(TOP_LEVEL_RULE_PREFIX, settingId);
  for (const rule of rules) {
    rule.condition.excludedRequestDomains ||= [];
    if (value === false) {
      addIfMissing(rule.condition.excludedRequestDomains, domain);
    } else {
      removeIfPresent(rule.condition.excludedRequestDomains, domain);
    }
  }
  await updateSessionRules(rules);
};

const setupTopLevelNetworkRules = async () => {
  // Create the top level network rule, without any excluded request domains.
  const rules = createPartialRules(TOP_LEVEL_RULE_PREFIX, {
    excludedRequestDomains: [],
    resourceTypes: ['main_frame']
  });
  rules.forEach(rule => relevantStringIds.add(rule.stringId));
  await updateSessionRules(rulesWithIntegerIds(rules));
  // Add necessary excluded request domains for the top level network rule.
  const allSettings = await getAllSettings();
  for (const [domain, settingId, value] of allSettings) {
    if (settingId in NETWORK_PROTECTION_DEFS) {
      await updateTopLevelNetworkRule(domain, settingId, value);
    }
  }
};

// Add or remove a tab id from the excluded tab ids for the subresource network rule.
const updateSubresourceNetworkRule = async (settingId, tabId, value) => {
  const rules = await getSessionRulesForSetting(SUBRESOURCE_RULE_PREFIX, settingId);
  for (const rule of rules) {
    rule.condition.excludedTabIds ||= [];
    if (value === false) {
      addIfMissing(rule.condition.excludedTabIds, tabId);
    } else {
      removeIfPresent(rule.condition.excludedTabIds, tabId);
    }
  }
  await updateSessionRules(rules);
};

const setupSubresourceNetworkRules = async () => {
  // Create the subresource network rules, initially without any excluded tab ids.
  const rules = createPartialRules(SUBRESOURCE_RULE_PREFIX, {
    excludedTabIds: [],
    excludedResourceTypes: ['main_frame']
  });
  rules.forEach(rule => relevantStringIds.add(rule.stringId));
  await updateSessionRules(rulesWithIntegerIds(rules));
  // Wait for a top-level request or navigation and, if the setting is enabled for the
  // top-level domain, update the subresource network rule to exclude the tabId from the
  // rule for that setting.
  const listener = async (details) => {
    try {
      const { url, tabId, frameId } = details;
      // For requests, frameId is undefined.
      // For navigations, frameId is 0 for the main frame.
      if (frameId !== 0 && frameId !== undefined) {
        return;
      }
      const domain = registrableDomainFromUrl(url);
      if (domain === null) {
        return;
      }
      for (const settingId of Object.keys(NETWORK_PROTECTION_DEFS)) {
        const setting = await getSetting(domain, settingId);
        await updateSubresourceNetworkRule(settingId, tabId, setting);
      }
    } catch (error) {
      logError(error, 'error updating subresource network rule for top-level navigation or request', details);
    }
  };
  chrome.webRequest.onBeforeRequest.addListener(listener, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webNavigation.onCommitted.addListener(listener);
};

export const setupNetworkRules = async () => {
  // We take a two-part approach to network protections:
  // 1. Protected top-level requests are exempted on domains for whch the user
  // has disabled protection.
  // 2. Protected subresource requests are exempted for tabs where the latest
  // top-level request or navigation was to a domain for which the user has
  // disabled protection.
  await setupTopLevelNetworkRules();
  await setupSubresourceNetworkRules();
};
