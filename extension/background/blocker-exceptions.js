/* global chrome */

import { registrableDomainFromUrl } from '../common/util.js';
import { getSetting } from '../common/settings.js';

export const createExceptionToStaticRules = async () => {
  const exceptionToStaticRules = {
    priority: 2,
    action: { type: 'allow' },
    id: 100,
    condition: {
      // urlFilter: '<all_urls>'
      // dummy tab id
      tabIds: [1]
    }
  };
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [100],
    addRules: [exceptionToStaticRules]
  });
  console.log('created exception to static rules');
  console.log('exceptionToStaticRules:', exceptionToStaticRules);
};

const updateExceptionToStaticRules = async (tabId, setting) => {
  const rules = await chrome.declarativeNetRequest.getSessionRules({
    ruleIds: [100]
  });
  const rule = rules[0];
  if (setting === false) {
    if (!rule.condition.tabIds.includes(tabId)) {
      console.log(`adding tabId ${tabId} to exception to static rules`);
      rule.condition.tabIds.push(tabId);
    }
  } else {
    console.log(`removing tabId ${tabId} from exception to static rules`);
    rule.condition.tabIds = rule.condition.tabIds.filter(t => t !== tabId);
  }
  console.log(`rule.condition.tabIds: ${rule.condition.tabIds}, setting: ${setting}`);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [rule.id],
    addRules: [rule]
  });
};

export const setupExceptionsToStaticRules = async () => {
  await createExceptionToStaticRules();
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
      const setting = await getSetting(domain, 'ads');
      console.log(`setting: ${setting} for domain: ${domain}`);
      await updateExceptionToStaticRules(tabId, setting);
    } catch (error) {
      console.error('error updating exception to static rules for top-level navigation or request', url, tabId, error);
    }
  };
  chrome.webRequest.onBeforeRequest.addListener(listener, {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame']
  });
  chrome.webNavigation.onCommitted.addListener(listener);
};
