/* global chrome */

import { registrableDomainFromUrl, logError } from '../common/util.js';
import { getSetting } from '../common/settings.js';

const tabIdToDomain = new Map();

const monitorDomainForTab = () => {
  const listener = async ({ url, tabId, frameId }) => {
    try {
      if (frameId !== 0 && frameId !== undefined) {
        return;
      }
      const domain = registrableDomainFromUrl(url);
      tabIdToDomain.set(tabId, domain);
      console.log('tabIdToDomain:', tabIdToDomain.entries());
    } catch (error) {
      logError(error, 'error monitoring domain for tab', {url, tabId});
    }
  };
  chrome.webRequest.onBeforeRequest.addListener(listener, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webNavigation.onCommitted.addListener(listener);
};

const fileExists = async (path) => {
  try {
    const url = chrome.runtime.getURL(path);
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const injectCssForCosmeticFilters = () => {
  monitorDomainForTab();
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    try {
      const topLevelDomain = tabIdToDomain.get(details.tabId);
      const setting = await getSetting(topLevelDomain, 'ads');
      if (setting === false) {
        return;
      }
      const files = [
        'content_scripts/adblock_css/_default_.css'
      ];
      const registrableDomain = registrableDomainFromUrl(details.url);
      if (registrableDomain === null) {
        return;
      }
      const domainSpecificFile = `content_scripts/adblock_css/${registrableDomain}_.css`;
      if (await fileExists(domainSpecificFile)) {
        files.push(domainSpecificFile);
      }
      await chrome.scripting.insertCSS({
        target: {
          tabId: details.tabId,
          frameIds: [details.frameId]
        },
        files
      });
      console.log('injected CSS for cosmetic filters for', registrableDomain, files);
    } catch (error) {
      logError(error, 'error injecting CSS for cosmetic filters', details);
    }
  }, { urls: ['<all_urls>'] });
};
