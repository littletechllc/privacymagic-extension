import { getAllSettings, getSetting } from '../common/settings.js';
import { logError, registrableDomainFromUrl, deepCopy, addIfMissing, removeIfPresent } from '../common/util.js';
import { IDS } from './ids.js';

const setHeaders = (headers) =>
  Object.entries(headers).map(
    ([header, value]) => ({ operation: 'set', header, value }));

const removeHeaders = (list) =>
  list.map(header => ({ operation: 'remove', header }));

const NETWORK_PROTECTION_DEFS = {
  gpc: [{
    id: IDS.GPC_RULE_ID,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { operation: 'set', header: 'Sec-GPC', value: '1' }
      ]
    }
  }],
  useragent: [{
    id: IDS.USERAGENT_RULE_ID,
    action: {
      type: 'modifyHeaders',
      requestHeaders: setHeaders({
        'Sec-CH-UA-Full-Version-List': 'Google Chrome;v="141.0.0.0", Not?A_Brand;v="8.0.0.0", Chromium;v="141.0.0.0"',
        'Sec-CH-UA-Full-Version': '141.0.0.0'
      })
    }
  }],
  queryParameters: [{
    id: IDS.QUERY_PARAMETERS_RULE_ID,
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
  network: [{
    id: IDS.NETWORK_RULE_ID,
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Downlink',
        'ECT',
        'RTT',
        'Save-Data',
        'Sec-CH-ECT'
      ])
    }
  }],
  screen: [{
    id: IDS.DISPLAY_RULE_ID,
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'DPR',
        'Sec-CH-Viewport-Height',
        'Sec-CH-Viewport-Width',
        'Sec-CH-DPR',
        'Viewport-Width'
      ])
    }
  }],
  display: [{
    id: IDS.DISPLAY_PREFERENCES_RULE_ID,
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Sec-CH-Prefers-Color-Scheme',
        'Sec-CH-Prefers-Reduced-Motion',
        'Sec-CH-Prefers-Reduced-Transparency'
      ])
    }
  }],
  language: [{
    id: IDS.LANGUAGE_RULE_ID,
    action: {
      type: 'modifyHeaders',
      requestHeaders: setHeaders({
        'Accept-Language': navigator.language
      })
    }
  }],
  memory: [{
    id: IDS.MEMORY_RULE_ID,
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Device-Memory',
        'Sec-CH-Device-Memory'
      ])
    }
  }],
  css: [{
    id: IDS.CSS_RULE_ID,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'append',
        header: 'Content-Security-Policy',
        // value: "style-src-elem 'none';"
        value: 'style-src-elem https:;'
        // value: "style-src-elem 'unsafe-inline';"
      }]
    }
  }],
  referrerPolicy: [{
    id: IDS.REFERRER_POLICY_RULE_1_ID,
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
    id: IDS.REFERRER_POLICY_RULE_2_ID,
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

const createPartialRules = (idOffset, condition) => {
  const newRules = [];
  for (const rules of Object.values(NETWORK_PROTECTION_DEFS)) {
    for (const rule of rules) {
      const newRule = deepCopy(rule);
      newRule.priority = 5;
      newRule.id = idOffset + newRule.id;
      newRule.condition = {
        ...newRule.condition,
        ...condition
      };
      newRules.push(newRule);
    }
  }
  return newRules;
};

const updateSessionRules = async (rules) => {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules
  });
};

const getSessionRulesForSetting = async (offset: number, settingId: string): Promise<chrome.declarativeNetRequest.Rule[]> => {
  if (!(settingId in NETWORK_PROTECTION_DEFS)) {
    return [];
  }
  const ids = NETWORK_PROTECTION_DEFS[settingId].map(rule => rule.id + offset);
  return await chrome.declarativeNetRequest.getSessionRules({ ruleIds: ids });
};

// Add or remove a domain from the excluded request domains for the top level network rule.
export const updateTopLevelNetworkRule = async (domain, setting, value) => {
  if (!(setting in NETWORK_PROTECTION_DEFS)) {
    return;
  }
  const rules = await getSessionRulesForSetting(IDS.TOP_LEVEL_RULE_ID_OFFSET, setting);
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
  const rules = createPartialRules(IDS.TOP_LEVEL_RULE_ID_OFFSET, {
    excludedRequestDomains: [],
    resourceTypes: ['main_frame']
  });
  await updateSessionRules(rules);
  // Add necessary excluded request domains for the top level network rule.
  const allSettings = await getAllSettings();
  for (const [domain, settingId, value] of allSettings) {
    if (settingId in NETWORK_PROTECTION_DEFS) {
      await updateTopLevelNetworkRule(domain, settingId, value);
    }
  }
};

const tabExceptionsForSetting: Map<string, Set<number>> = new Map();

// Add or remove a tab id from the excluded tab ids for the subresource network rule.
const updateSubresourceNetworkRule = async (settingId, tabId, value) => {
  const tabExceptions = tabExceptionsForSetting.get(settingId) || new Set();
  if (value === false) {
    tabExceptions.add(tabId);
  } else {
    tabExceptions.delete(tabId);
  }
  const partialRules = NETWORK_PROTECTION_DEFS[settingId];
  const rules = partialRules.map(
    partialRule => ({
      ...partialRule,
      id: partialRule.id + IDS.SUBRESOURCE_RULE_ID_OFFSET,
      priority: 2,
      condition: {
        excludedTabIds: [...tabExceptions],
        resourceTypes: ['sub_frame']
      }
    }));
  await updateSessionRules(rules);
};

let subresourceNetworkListener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => Promise<void>) | null = null;

const setupSubresourceNetworkRules = async () => {
  // Create the subresource network rules, initially without any excluded tab ids.
  const rules = createPartialRules(IDS.SUBRESOURCE_RULE_ID_OFFSET, {
    excludedTabIds: [],
    excludedResourceTypes: ['sub_frame']
  });
  await updateSessionRules(rules);
  // Wait for a top-level request or navigation and, if the setting is enabled for the
  // top-level domain, update the subresource network rule to exclude the tabId from the
  // rule for that setting.
  if (subresourceNetworkListener !== null) {
    chrome.webNavigation.onCommitted.removeListener(subresourceNetworkListener);
  }
  subresourceNetworkListener = async (details) => {
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
  chrome.webNavigation.onCommitted.addListener(subresourceNetworkListener);
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
