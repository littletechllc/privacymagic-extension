/* global chrome */

import { getAllSettings, getSetting } from '../common/settings.js';
import { registrableDomainFromUrl } from '../common/util.js';

const NETWORK_PROTECTION_DEFS = {
  gpc: {
    addRequestHeaders: {
      'Sec-GPC': '1'
    }
  },
  useragent: {
    addRequestHeaders: {
      'Sec-CH-UA-Arch': 'arm',
      'Sec-CH-UA-Bitness': '64',
      'Sec-CH-UA-Form-Factors-List': 'Desktop',
      'Sec-CH-UA-Form-Factors': 'Desktop',
      'Sec-CH-UA-Full-Version-List': 'Google Chrome;v="141.0.0.0", Not?A_Brand;v="8.0.0.0", Chromium;v="141.0.0.0"',
      'Sec-CH-UA-Full-Version': '141.0.0.0'
    }
  },
  query_parameters: {
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
    removeRequestHeaders: [
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
  },
  referrer_policy: {
    capReferrerPolicy: true
  }
};

const idManager = {
  settingToIdInteger: {},
  idCounter: 0,
  addIdForSetting (setting) {
    this.settingToIdInteger[setting] = this.settingToIdInteger[setting] || [];
    this.settingToIdInteger[setting].push(this.idCounter + 1);
    this.idCounter++;
    return this.idCounter;
  },
  getIdsForSetting (setting) {
    return this.settingToIdInteger[setting] || [];
  }
};

const createAddRequestHeaderAction = (addRequestHeaders) => {
  const requestHeaders = Object.entries(addRequestHeaders).map(
    ([header, value]) => ({ operation: 'set', header, value }));
  return { type: 'modifyHeaders', requestHeaders };
};

const createParamAction = (removeParams) => ({
  type: 'redirect',
  redirect: {
    transform: { queryTransform: { removeParams } }
  }
});

const createRemoveRequestHeaderAction = (removeRequestHeaders) => ({
  type: 'modifyHeaders',
  requestHeaders: removeRequestHeaders.map(header => ({ operation: 'remove', header }))
});

const createCapReferrerPolicyRules = () => ([{
  condition: {
    excludedResponseHeaders: [{
      header: 'referrer-policy',
      values: ['no-referrer', 'origin', 'same-origin', 'strict-origin']
    }]
  },
  action: {
    type: 'modifyHeaders',
    responseHeaders: [{
      operation: 'set',
      header: 'referrer-policy',
      value: 'strict-origin-when-cross-origin'
    }]
  }
}, {
  condition: {
    responseHeaders: [{
      header: 'referrer-policy',
      values: ['origin']
    }]
  },
  action: {
    type: 'modifyHeaders',
    responseHeaders: [{
      operation: 'set',
      header: 'referrer-policy',
      value: 'strict-origin'
    }]
  }
}]);

const createPartialRules = (settingId, condition) => {
  const config = NETWORK_PROTECTION_DEFS[settingId];
  const { addRequestHeaders, removeParams, removeRequestHeaders, capReferrerPolicy } = config;
  const rules = [];
  if (capReferrerPolicy) {
    rules.push(...createCapReferrerPolicyRules());
  }
  if (addRequestHeaders) {
    rules.push({ action: createAddRequestHeaderAction(addRequestHeaders) });
  }
  if (removeParams) {
    rules.push({ action: createParamAction(removeParams) });
  }
  if (removeRequestHeaders) {
    rules.push({ action: createRemoveRequestHeaderAction(removeRequestHeaders) });
  }
  for (const rule of rules) {
    rule.id = idManager.addIdForSetting(settingId);
    rule.priority = 1;
    rule.condition = {
      ...rule.condition,
      ...condition
    };
  }
  return rules;
};

const updateSessionRules = async (rules) => {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules
  });
};

// Create the top level network rule, without any excluded request domains.
const createTopLevelNetworkRule = async (settingId) => {
  const rules = createPartialRules(settingId, {
    excludedRequestDomains: [],
    resourceTypes: ['main_frame']
  });
  await updateSessionRules(rules);
};

// Add or remove a domain from the excluded request domains for the top level network rule.
export const updateTopLevelNetworkRule = async (domain, settingId, value) => {
  if (!(settingId in NETWORK_PROTECTION_DEFS)) {
    return;
  }
  const rules = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: idManager.getIdsForSetting(settingId)
  });
  for (const rule of rules) {
    const excludedRequestDomains = rule.condition.excludedRequestDomains || [];
    if (value === false) {
      if (!excludedRequestDomains.includes(domain)) {
        excludedRequestDomains.push(domain);
      }
    } else {
      if (excludedRequestDomains.includes(domain)) {
        rule.condition.excludedRequestDomains =
          excludedRequestDomains.filter(d => d !== domain);
      }
    }
  }
  await updateSessionRules(rules);
};

const setupTopLevelNetworkRules = async () => {
  // Create the top level network rule, without any excluded request domains.
  for (const settingId of Object.keys(NETWORK_PROTECTION_DEFS)) {
    await createTopLevelNetworkRule(settingId);
  }
  // Add necessary excluded request domains for the top level network rule.
  const allSettings = await getAllSettings();
  for (const [domain, settingId, value] of allSettings) {
    if (settingId in NETWORK_PROTECTION_DEFS) {
      await updateTopLevelNetworkRule(domain, settingId, value);
    }
  }
};

// Create the subresource network rule, without any excluded tab ids.
const createSubresourceNetworkRule = async (settingId) => {
  const rules = createPartialRules(settingId, {
    excludedTabIds: [],
    excludedResourceTypes: ['main_frame']
  });
  await updateSessionRules(rules);
};

// Add or remove a tab id from the excluded tab ids for the subresource network rule.
const updateSubresourceNetworkRule = async (settingId, tabId, value) => {
  const rules = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: idManager.getIdsForSetting(settingId)
  });
  for (const rule of rules) {
    const excludedTabIds = rule.condition.excludedTabIds || [];
    if (value === false) {
      if (!excludedTabIds.includes(tabId)) {
        excludedTabIds.push(tabId);
      }
    } else {
      if (excludedTabIds.includes(tabId)) {
        rule.condition.excludedTabIds = excludedTabIds.filter(t => t !== tabId);
      }
    }
  }
  await updateSessionRules(rules);
};

const setupSubresourceNetworkRules = async () => {
  // Create the subresource network rules, initially without any excluded tab ids.
  for (const settingId of Object.keys(NETWORK_PROTECTION_DEFS)) {
    await createSubresourceNetworkRule(settingId);
  }
  // Wait for a top-level request or navigation and, if the setting is enabled for the
  // top-level domain, update the subresource network rule to exclude the tabId from the
  // rule for that setting.
  const listener = async ({ url, tabId, frameId }) => {
    try {
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
      console.error('error updating subresource network rule for top-level navigation or request', url, tabId, error);
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
