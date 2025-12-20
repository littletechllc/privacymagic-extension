/* global chrome */

import { registrableDomainFromUrl, logError, addIfMissing, removeIfPresent } from '../common/util.js';
import { getSetting } from '../common/settings.js';
import { IDS } from './ids.js';

/** @type {chrome.declarativeNetRequest.Rule} */
const exceptionToStaticRules = {
  priority: 2,
  action: { type: 'allow' },
  id: IDS.EXCEPTION_TO_STATIC_RULES_RULE_ID,
  condition: {
    urlFilter: '*://*/*',
    tabIds: []
  }
};

export const updateExceptionToStaticRules = async () => {
  const rulesToAdd = [];
  if (exceptionToStaticRules?.condition?.tabIds &&
      exceptionToStaticRules.condition.tabIds.length > 0) {
    rulesToAdd.push(exceptionToStaticRules);
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [exceptionToStaticRules.id],
    addRules: rulesToAdd
  });
};

const adjustExceptionToStaticRules = async (tabId, setting) => {
  if (setting === false) {
    addIfMissing(exceptionToStaticRules.condition.tabIds, tabId);
  } else {
    removeIfPresent(exceptionToStaticRules.condition.tabIds, tabId);
  }
  await updateExceptionToStaticRules();
};

export const setupExceptionsToStaticRules = async () => {
  await updateExceptionToStaticRules();
  const listener = async (details) => {
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
      const setting = await getSetting(domain, 'ads');
      await adjustExceptionToStaticRules(tabId, setting);
    } catch (error) {
      logError(error, 'error updating exception to static rules for top-level navigation or request', details);
    }
  };
  chrome.webNavigation.onCommitted.addListener(listener);
};
