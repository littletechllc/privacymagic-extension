import { getAllSettings } from '../common/settings.js';
import { registrableDomainFromUrl } from '../common/util.js';
import { IDS } from './ids.js';

const topDomainAllowList: Set<string> = new Set();

const tabExceptions: Set<number> = new Set();

export const updateExceptionToStaticRules = async (): Promise<void> => {
  const addRules: chrome.declarativeNetRequest.Rule[] = [];
  if (tabExceptions.size > 0) {
    const rule: chrome.declarativeNetRequest.Rule = {
      priority: 3,
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

export const adjustExceptionToStaticRules = async (domain: string, settingValue: boolean): Promise<void> => {
  if (settingValue === false) {
    topDomainAllowList.add(domain);
  } else {
    topDomainAllowList.delete(domain);
  }
  console.log('topDomainAllowList:', topDomainAllowList);
  await updateExceptionToStaticRules();
};

export const setupExceptionsToStaticRules = async (): Promise<void> => {
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
