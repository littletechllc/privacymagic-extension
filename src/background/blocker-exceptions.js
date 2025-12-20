/* global chrome */

import { registrableDomainFromUrl, logError, addIfMissing, removeIfPresent } from '../common/util.js';
import { getSetting } from '../common/settings.js';
import { IDS } from './ids.js';

/** @type {number[]} */
const exceptionToStaticRuleTabIds = [];

/** @type {() => Promise<void>} */
export const updateExceptionToStaticRules = async () => {
  const removeRuleIds = [IDS.EXCEPTION_TO_STATIC_RULES_RULE_ID];
  const addRules = [];
  if (exceptionToStaticRuleTabIds.length > 0) {
    /** @type {chrome.declarativeNetRequest.Rule} */
    const rule = {
      priority: 2,
      action: { type: /** @type {const} */ ('allow') },
      id: IDS.EXCEPTION_TO_STATIC_RULES_RULE_ID,
      condition: {
        urlFilter: '*://*/*',
        tabIds: [...exceptionToStaticRuleTabIds]
      }
    };
    addRules.push(rule);
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds,
    addRules
  });
};

/** @type {(tabId: number, settingValue: boolean) => Promise<void>} */
const adjustExceptionToStaticRules = async (tabId, settingValue) => {
  if (settingValue === false) {
    addIfMissing(exceptionToStaticRuleTabIds, tabId);
  } else {
    removeIfPresent(exceptionToStaticRuleTabIds, tabId);
  }
  await updateExceptionToStaticRules();
};

/** @type {((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => Promise<void>) | null} */
let exceptionListener = null;

/** @type {() => Promise<void>} */
export const setupExceptionsToStaticRules = async () => {
  await updateExceptionToStaticRules();
  if (exceptionListener !== null) {
    chrome.webNavigation.onCommitted.removeListener(exceptionListener);
  }
  exceptionListener = async (details) => {
    try {
      const { url, tabId, frameId } = details;
      // For navigations, frameId is 0 for the main frame.
      if (frameId !== 0 && frameId !== undefined) {
        return;
      }
      const domain = registrableDomainFromUrl(url);
      if (domain === null) {
        return;
      }
      const settingValue = await getSetting(domain, 'ads');
      await adjustExceptionToStaticRules(tabId, settingValue);
    } catch (error) {
      logError(error, 'error updating exception to static rules for top-level navigation or request', details);
    }
  };
  chrome.webNavigation.onCommitted.addListener(exceptionListener);
};
