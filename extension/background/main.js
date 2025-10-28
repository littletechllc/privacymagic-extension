import { setToolbarIcon } from '../common/toolbar-icon.js'
import { initializeDynamicRules, clearDynamicRules } from './rules-generator.js'
import { injectCssForCosmeticFilters } from './cosmetic-filter-manager.js';
import { THEME_CONFIG } from '../common/theme.js';
import { updateContentScripts, createContentScripts } from './content-scripts.js';
import { listenForSettingsChanges, setSetting, getAllSettings, SETTINGS_KEY_PREFIX } from '../common/settings.js';
import psl from '../thirdparty/psl.mjs';

const PRIVACY_MAGIC_HEADERS = {
  gpc: {
    headers: {
      'Sec-GPC': '1',
    },
    id: 1,
  },
}

const ALL_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other"
]

// Create the top level header rule, without any excluded request domains.
const createTopLevelHeaderRule = async (settingId) => {
  const { headers, id } = PRIVACY_MAGIC_HEADERS[settingId];
  const requestHeaders = Object.entries(headers).map(
    ([header, value]) => ({operation: "set", header, value}))
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [id],
    addRules: [
      {
        id,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders
        },
        condition: {
          excludedRequestDomains: [],
          resourceTypes: ["main_frame"],
        },
      },
    ],
  });
};

// Add or remove a domain from the excluded request domains for the top level header rule.
const updateHeaderRule = async (domain, settingId, value) => {
  console.log(`updateHeaderRule(${domain}, ${settingId}, ${value})`);
  if (!settingId in PRIVACY_MAGIC_HEADERS) {
    return;
  }
  const { headers, id } = PRIVACY_MAGIC_HEADERS[settingId];
  const rules = await chrome.declarativeNetRequest.getDynamicRules({
    ruleIds: [id],
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
  console.log("rules:", rules);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules,
  });
};

// Create the subresource header rule, without any excluded tab ids.
const createSubresourceHeaderRule = async (settingId) => {
  const { headers, id } = PRIVACY_MAGIC_HEADERS[settingId];
  const requestHeaders = Object.entries(headers).map(
    ([header, value]) => ({operation: "set", header, value}))
    const rules = [
      {
        id: 1000 + id,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders
        },
        condition: {
          excludedTabIds: [],
          excludedResourceTypes: ["main_frame"],
        },
      },
    ];
  await chrome.declarativeNetRequest.updateSessionRules({ addRules: rules });
  return rules;
}

// Add or remove a tab id from the excluded tab ids for the subresource header rule.
const toggleExcludedTabIdsForSubresourceHeader = async (settingId, tabId, value) => {
  const { headers, id } = PRIVACY_MAGIC_HEADERS[settingId];
  let rules = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: [id + 1000],
  });
  for (const rule of rules) {
    if (value === false) {
      if (!rule.condition.excludedTabIds.includes(tabId)) {
        rule.condition.excludedTabIds.push(tabId);
      }
    } else {
      if (rule.condition.excludedTabIds.includes(tabId)) {
        rule.condition.excludedTabIds = rule.condition.excludedTabIds.filter(t => t !== tabId);
      }
    }
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules,
  });
};



const getExcludedRequestDomains = async (allSettings) => {
  const excludedRequestDomains = {};
  for (const [[type, domain, settingId], value] of allSettings) {
    if (type === SETTINGS_KEY_PREFIX && settingId in PRIVACY_MAGIC_HEADERS) {
      if (value === false) {
        excludedRequestDomains[settingId] ||= [];
        excludedRequestDomains[settingId].push(domain);
      }
    }
  }
  return excludedRequestDomains;
}

const setupTopLevelHeaders = async () => {
  // Create the top level header rule, without any excluded request domains.
  const allSettings = await getAllSettings();
  for (const settingId of Object.keys(PRIVACY_MAGIC_HEADERS)) {
    await createTopLevelHeaderRule(settingId);
  }
  // Add necessary excluded request domains for the top level header rule.
  for (const [[type, domain, settingId], value] of allSettings) {
    if (type === SETTINGS_KEY_PREFIX && settingId in PRIVACY_MAGIC_HEADERS) {
      await updateHeaderRule(domain, settingId, value);
    }
  }
};

const setupSubresourceHeaders = async () => {
  // Create the subresource header rules, without any excluded tab ids.
  for (const settingId of Object.keys(PRIVACY_MAGIC_HEADERS)) {
    await createSubresourceHeaderRule(settingId);
  }
  // Wait for a top-level request and add the appropriate excluded tab ids
  // for the subresource header rule.
  chrome.webRequest.onBeforeRequest.addListener(async (details) => {
    const domain = psl.get(new URL(details.url).hostname);
    if (domain === null) {
      return;
    }
    for (const settingId of Object.keys(PRIVACY_MAGIC_HEADERS)) {
      const setting = await getSetting(registrableDomain, settingId);
      const value = await getSetting(SETTINGS_KEY_PREFIX, domain, 'connections', 'headers', settingId);
      if (value === true) {
        await toggleExcludedTabIdsForSubresourceHeader(settingId, details.tabId, true);
      }
    }
      await toggleExcludedTabIdsForSubresourceHeader(settingId, details.tabId, true);
  }, {urls: ["<all_urls>"], types: ["main_frame"]});
  const allSettings = await getAllSettings();
  for (const [[type, domain, settingId], value] of allSettings) {
    if (type === SETTINGS_KEY_PREFIX && settingId in PRIVACY_MAGIC_HEADERS) {
      await toggleExcludedDomainForSubresourceHeader(settingId, domain, value);
    }
  }
};
const setupHeaders = async () => {
  await setupTopLevelHeaders();
  //await setupSubresourceHeaders();
};

const updateSetting = async (domain, settingId, value) => {
  await setSetting(domain, settingId, value);
  await updateContentScripts(domain, settingId, value);
  //await updateHeaderRule(domain, settingId, value);
}

chrome.runtime.onInstalled.addListener(async function (details) {
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'updateSetting') {
      await updateSetting(message.domain, message.settingId, message.value);
    }
    return true;
  });
  await setToolbarIcon(THEME_CONFIG.toolbarIcon)
  await clearDynamicRules();
  //await chrome.runtime.openOptionsPage()
  const t1 = performance.now();
  //await initializeDynamicRules();
  const t2 = performance.now();
  console.log(`initializeDynamicRules took ${t2 - t1} milliseconds`);
  //const contentBlockingDefinitionsUrl = chrome.runtime.getURL('rules/content-blocking-definitions.json');
  const t4 = performance.now();
  //console.log(`fetchJson took ${t4 - t3} milliseconds`);
  injectCssForCosmeticFilters();
  const t5 = performance.now();
  console.log(`injectCssForCosmeticFilters took ${t5 - t4} milliseconds`);
  for (const settingId of Object.keys(PRIVACY_MAGIC_HEADERS)) {
    await createContentScripts(settingId);
  }
  const t6 = performance.now();
  console.log(`setupContentScripts took ${t6 - t5} milliseconds`);
  await setupHeaders();
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
});
