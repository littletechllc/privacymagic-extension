/* global chrome */

import { getDnrIdForKey, TOP_LEVEL_RULE_PREFIX, SUBRESOURCE_RULE_PREFIX, registrableDomainFromUrl, logError } from '../common/util.js';
import { getAllSettings } from '../common/settings.js';

const disabledSettingsForDomain = {};

const cacheDisabledSettingsForDomain = (domain, settingId, value) => {
  disabledSettingsForDomain[domain] ||= [];
  if (value === false) {
    disabledSettingsForDomain[domain].push(settingId);
  } else {
    disabledSettingsForDomain[domain] = disabledSettingsForDomain[domain].filter(s => s !== settingId);
    if (disabledSettingsForDomain[domain].length === 0) {
      delete disabledSettingsForDomain[domain];
    }
  }
};

const getDisabledSettingsForDomain = (domain) => {
  return disabledSettingsForDomain[domain] || [];
};

const createActionForSettings = (disabledSettings) => {
  const cookieKeyVal = `__pm__disabled_settings = ${disabledSettings.join(',')}`;
  const headerValue = `${cookieKeyVal}; Secure; SameSite=None; Path=/; Partitioned`;
  return {
    type: 'modifyHeaders',
    responseHeaders: [
      { operation: 'append', header: 'Set-Cookie', value: headerValue }
    ]
  };
};

const createRuleForDomain = (domain, disabledSettings) => {
  const action = createActionForSettings(disabledSettings);
  const id = getDnrIdForKey(`${TOP_LEVEL_RULE_PREFIX}_domain_${domain}`);
  return {
    id,
    priority: 5,
    action,
    condition: {
      urlFilter: `||${domain}/`,
      resourceTypes: ['main_frame']
    }
  };
};

const createRuleForTab = (tabId, disabledSettings) => {
  const action = createActionForSettings(disabledSettings);
  const id = getDnrIdForKey(`${SUBRESOURCE_RULE_PREFIX}_tab_${tabId}`);
  return {
    id,
    priority: 5,
    action,
    condition: {
      tabIds: [tabId],
      resourceTypes: ['sub_frame']
    }
  };
};

const applyDisabledSettingsForTabs = () => {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    try {
      const domain = registrableDomainFromUrl(details.url);
      const disabledSettings = getDisabledSettingsForDomain(domain);
      const rule = createRuleForTab(details.tabId, disabledSettings);
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] });
    } catch (error) {
      logError(error, 'error applying disabled settings for tabs', details);
    }
  });
};

export const updateContentScripts = async (domain, settingId, value) => {
  cacheDisabledSettingsForDomain(domain, settingId, value);
  const rule = createRuleForDomain(domain, getDisabledSettingsForDomain(domain));
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] });
};

const initializeContentScripts = async () => {
  const settings = await getAllSettings();
  for (const [domain, settingId, value] of settings) {
    await updateContentScripts(domain, settingId, value);
  }
};

export const setupContentScripts = async () => {
  const mainForegroundRule = {
    matchOriginAsFallback: true,
    persistAcrossSessions: false,
    runAt: 'document_start',
    allFrames: true,
    id: 'foreground',
    js: ['content_scripts/foreground.js'],
    matches: ['<all_urls>'],
    world: 'MAIN'
  };
  await chrome.scripting.registerContentScripts([mainForegroundRule]);
  await initializeContentScripts();
  applyDisabledSettingsForTabs();
};
