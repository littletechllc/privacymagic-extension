/* global chrome */

import { registrableDomainFromUrl, logError } from '../common/util.js';
import { getAllSettings } from '../common/settings.js';
import { IDS } from './ids.js';

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

// Create a rule that adds a Set-Cookie header to the response
// that contains the disabled settings for the domain. The content
// script will then read the Set-Cookie header, apply the disabled
// settings in the frame context, and delete the cookie so it is
// not visible to page scripts or sent to the server.
const createActionForSettings = (disabledSettings) => {
  const cookieKeyVal = `__pm__disabled_settings = ${disabledSettings.join(',')}`;
  const headerValue = `${cookieKeyVal}; Secure; SameSite=None; Path=/; Partitioned`;
  return {
    type: /** @type {const} */ ('modifyHeaders'),
    responseHeaders: [
      { operation: /** @type {const} */ ('append'), header: 'Set-Cookie', value: headerValue }
    ]
  };
};

/** @type { (domain: string, disabledSettings: string[]) => chrome.declarativeNetRequest.Rule } */
const createRuleForDomain = (domain, disabledSettings) => {
  const action = createActionForSettings(disabledSettings);
  return {
    id: IDS.CONTENT_SCRIPTS_TOP_LEVEL_RULE_ID,
    priority: 5,
    action,
    condition: {
      urlFilter: `||${domain}/`,
      resourceTypes: ['main_frame']
    }
  };
};

/** @type { (tabId: number, disabledSettings: string[]) => chrome.declarativeNetRequest.Rule } */
const createRuleForTab = (tabId, disabledSettings) => {
  const action = createActionForSettings(disabledSettings);
  return {
    id: IDS.CONTENT_SCRIPTS_SUBRESOURCE_RULE_ID,
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
      chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] });
    } catch (error) {
      logError(error, 'error applying disabled settings for tabs', details);
    }
  });
};

export const updateContentScripts = async (domain, settingId, value) => {
  cacheDisabledSettingsForDomain(domain, settingId, value);
  const rule = createRuleForDomain(domain, getDisabledSettingsForDomain(domain));
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] });
};

const initializeContentScripts = async () => {
  const settings = await getAllSettings();
  for (const [domain, settingId, value] of settings) {
    await updateContentScripts(domain, settingId, value);
  }
};

export const setupContentScripts = async () => {
  /** @type {chrome.scripting.RegisteredContentScript} */
  const mainForegroundRule = {
    matchOriginAsFallback: true,
    persistAcrossSessions: false,
    runAt: 'document_start',
    allFrames: true,
    id: 'foreground',
    js: ['content_scripts/content.js'],
    matches: ['<all_urls>'],
    world: 'MAIN'
  };
  await chrome.scripting.registerContentScripts([mainForegroundRule]);
  await initializeContentScripts();
  applyDisabledSettingsForTabs();
};
