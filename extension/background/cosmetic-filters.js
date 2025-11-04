/* global chrome */

import psl from '../thirdparty/psl.mjs';
import { getSetting } from '../common/settings.js';

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
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    try {
      const url = new URL(details.url);
      const registrableDomain = psl.get(url.hostname);
      if (registrableDomain === null) {
        return;
      }
      const setting = await getSetting(registrableDomain, 'ads');
      if (!setting) {
        return;
      }
      const files = [
        'content_scripts/adblock_css/_default_.css'
      ];
      const domainSpecificFile = `content_scripts/adblock_css/${registrableDomain}_.css`;
      if (await fileExists(domainSpecificFile)) {
        files.push(domainSpecificFile);
      }
      chrome.scripting.insertCSS({
        target: {
          tabId: details.tabId,
          frameIds: [details.frameId]
        },
        files
      });
      console.log('injected CSS for cosmetic filters for', registrableDomain, files);
    } catch (error) {
      console.error('error injecting CSS for cosmetic filters for', details, error);
    }
  }, { urls: ['<all_urls>'] });
};
