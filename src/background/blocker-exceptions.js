/* global chrome */

import { getAllSettings } from '../common/settings.js';
import { registrableDomainFromUrl } from '../common/util.js';
import { IDS } from './ids.js';

/** @type {Set<string>} */
const topDomainAllowList = new Set();

/** @type {Set<number>} */
const tabExceptions = new Set();

/** @type {() => Promise<void>} */
export const updateExceptionToStaticRules = async () => {
  const addRules = [];
  if (tabExceptions.size > 0) {
    /** @type {chrome.declarativeNetRequest.Rule} */
    const rule = {
      priority: 2,
      action: { type: 'allow' },
      id: IDS.EXCEPTION_TO_STATIC_RULES_RULE_ID,
      condition: {
        tabIds: [...tabExceptions]
      }
    };
    addRules.push(rule);
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules,
    removeRuleIds: [IDS.EXCEPTION_TO_STATIC_RULES_RULE_ID]
  });
};

/** @type {(domain: string, settingValue: boolean) => Promise<void>} */
export const adjustExceptionToStaticRules = async (domain, settingValue) => {
  if (settingValue === false) {
    topDomainAllowList.add(domain);
  } else {
    topDomainAllowList.delete(domain);
  }
  console.log('topDomainAllowList:', topDomainAllowList);
  await updateExceptionToStaticRules();
};

/** @type {() => Promise<void>} */
export const setupExceptionsToStaticRules = async () => {
  await updateExceptionToStaticRules();
  const allSettings = await getAllSettings();
  for (const [domain, settingId, value] of allSettings) {
    if (settingId === 'ads' && value === false) {
      topDomainAllowList.add(domain);
    }
  }
  chrome.webRequest.onBeforeRequest.addListener((details) => {
    if (details.type === 'main_frame') {
      const domain = registrableDomainFromUrl(details.url);
      if (domain === null) {
        return { cancel: false };
      }
      if (topDomainAllowList.has(domain)) {
        tabExceptions.add(details.tabId);
      } else {
        tabExceptions.delete(details.tabId);
      }
      updateExceptionToStaticRules();
      return { cancel: false };
    }
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
};
