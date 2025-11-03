/* global chrome */

import psl from '../thirdparty/psl.mjs';
import { getAllSettings, SETTINGS_KEY_PREFIX, getSetting } from '../common/settings.js';

const PRIVACY_MAGIC_HEADERS = {
  gpc: {
    id: 1,
    addHeaders: {
      'Sec-GPC': '1'
    }
  },
  useragent: {
    id: 2,
    addHeaders: {
      'Sec-CH-UA-Arch': 'arm',
      'Sec-CH-UA-Bitness': '64',
      'Sec-CH-UA-Form-Factors-List': 'Desktop',
      'Sec-CH-UA-Form-Factors': 'Desktop',
      'Sec-CH-UA-Full-Version-List': 'Google Chrome;v="141.0.0.0", Not?A_Brand;v="8.0.0.0", Chromium;v="141.0.0.0"',
      'Sec-CH-UA-Full-Version': '141.0.0.0'
    }
  },
  query_parameters: {
    id: 3,
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
  },
  client_hints: {
    id: 4,
    removeHeaders: [
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
    ]
  }
};

const createAddHeaderAction = (addHeaders) => {
  const requestHeaders = Object.entries(addHeaders).map(
    ([header, value]) => ({ operation: 'set', header, value }));
  return { type: 'modifyHeaders', requestHeaders };
};

const createParamAction = (removeParams) => ({
  type: 'redirect',
  redirect: {
    transform: { queryTransform: { removeParams } }
  }
});

const createRemoveHeaderAction = (removeHeaders) => ({
  type: 'modifyHeaders',
  requestHeaders: removeHeaders.map(header => ({ operation: 'remove', header }))
});

// Create the top level header rule, without any excluded request domains.
const createTopLevelHeaderRule = async (settingId) => {
  const { addHeaders, removeParams, removeHeaders, id } = PRIVACY_MAGIC_HEADERS[settingId];
  let action;
  if (addHeaders) {
    action = createAddHeaderAction(addHeaders);
  }
  if (removeHeaders) {
    action = createRemoveHeaderAction(removeHeaders);
  }
  if (removeParams) {
    action = createParamAction(removeParams);
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [id],
    addRules: [
      {
        priority: 1,
        action,
        id,
        condition: {
          excludedRequestDomains: [],
          resourceTypes: ['main_frame']
        }
      }
    ]
  });
};

// Add or remove a domain from the excluded request domains for the top level header rule.
export const updateTopLevelHeaderRule = async (domain, settingId, value) => {
  if (!(settingId in PRIVACY_MAGIC_HEADERS)) {
    return;
  }
  const { id } = PRIVACY_MAGIC_HEADERS[settingId];
  const rules = await chrome.declarativeNetRequest.getDynamicRules({
    ruleIds: [id]
  });
  for (const rule of rules) {
    if (value === false) {
      if (!rule.condition.excludedRequestDomains.includes(domain)) {
        rule.condition.excludedRequestDomains.push(domain);
      }
    } else {
      if (rule.condition.excludedRequestDomains.includes(domain)) {
        rule.condition.excludedRequestDomains =
          rule.condition.excludedRequestDomains.filter(d => d !== domain);
      }
    }
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules
  });
};

const setupTopLevelHeaderRules = async () => {
  // Create the top level header rule, without any excluded request domains.
  const allSettings = await getAllSettings();
  for (const settingId of Object.keys(PRIVACY_MAGIC_HEADERS)) {
    await createTopLevelHeaderRule(settingId);
  }
  // Add necessary excluded request domains for the top level header rule.
  for (const [[type, domain, settingId], value] of allSettings) {
    if (type === SETTINGS_KEY_PREFIX && settingId in PRIVACY_MAGIC_HEADERS) {
      await updateTopLevelHeaderRule(domain, settingId, value);
    }
  }
};

// Create the subresource header rule, without any excluded tab ids.
const createSubresourceHeaderRule = async (settingId) => {
  const { addHeaders, removeParams, removeHeaders, id } = PRIVACY_MAGIC_HEADERS[settingId];
  let action;
  if (addHeaders) {
    action = createAddHeaderAction(addHeaders);
  }
  if (removeParams) {
    action = createParamAction(removeParams);
  }
  if (removeHeaders) {
    action = createRemoveHeaderAction(removeHeaders);
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [id],
    addRules: [
      {
        action,
        priority: 1,
        id: 2500 + id,
        condition: {
          excludedTabIds: [],
          excludedResourceTypes: ['main_frame']
        }
      }
    ]
  });
};

// Add or remove a tab id from the excluded tab ids for the subresource header rule.
const updateSubresourceHeaderRule = async (settingId, tabId, value) => {
  const { id } = PRIVACY_MAGIC_HEADERS[settingId];
  const rules = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: [2500 + id]
  });
  const rule = rules[0];
  if (value === false) {
    if (!rule.condition.excludedTabIds.includes(tabId)) {
      rule.condition.excludedTabIds.push(tabId);
    }
  } else {
    if (rule.condition.excludedTabIds.includes(tabId)) {
      rule.condition.excludedTabIds = rule.condition.excludedTabIds.filter(t => t !== tabId);
    }
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [rule.id],
    addRules: [rule]
  });
};

const setupSubresourceHeaderRules = async () => {
  // Create the subresource header rules, initially without any excluded tab ids.
  for (const settingId of Object.keys(PRIVACY_MAGIC_HEADERS)) {
    await createSubresourceHeaderRule(settingId);
  }
  // Wait for a top-level request or navigation and, if the setting is enabled for the
  // top-level domain, update the subresource header rule to exclude the tabId from the
  // rule for that setting.
  const listener = async ({ url, tabId }) => {
    const domain = psl.get(new URL(url).hostname);
    if (domain === null) {
      return;
    }
    for (const settingId of Object.keys(PRIVACY_MAGIC_HEADERS)) {
      const setting = await getSetting(domain, settingId);
      await updateSubresourceHeaderRule(settingId, tabId, setting);
    }
  };
  chrome.webRequest.onBeforeRequest.addListener(listener, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webNavigation.onCommitted.addListener(listener, { urls: ['<all_urls>'] });
};

export const setupHeaderRules = async () => {
  // We take a two-part approach to header protections:
  // 1. Protected headers on top-level requests are exempted on domains for whch the user
  // has disabled protection.
  // 2. Protected headers on subresource requests are exempted for tabs where the latest
  // top-level request or navigation was to a domain for which the user has disabled protection.
  await setupTopLevelHeaderRules();
  await setupSubresourceHeaderRules();
};
