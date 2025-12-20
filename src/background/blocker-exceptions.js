/* global chrome */

import { getAllSettings } from '../common/settings.js';
import { IDS } from './ids.js';

/** @type {Set<string>} */
const topDomainAllowList = new Set();

/** @type {() => Promise<void>} */
const updateExceptionToStaticRules = async () => {
  const removeRuleIds = [IDS.EXCEPTION_TO_STATIC_RULES_RULE_ID];
  const addRules = [];
  if (topDomainAllowList.size > 0) {
    /** @type {chrome.declarativeNetRequest.Rule} */
    const rule = {
      priority: 2,
      action: { type: /** @type {const} */ ('allowAllRequests') },
      id: IDS.EXCEPTION_TO_STATIC_RULES_RULE_ID,
      condition: {
        resourceTypes: ['main_frame'],
        requestDomains: Array.from(topDomainAllowList)
      }
    };
    addRules.push(rule);
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds,
    addRules
  });
  console.log('updateExceptionToStaticRules: topDomainAllowList:', Array.from(topDomainAllowList), 'addRules:', addRules);
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
    if (settingId === 'ads') {
      await adjustExceptionToStaticRules(domain, value);
    }
  }
};
