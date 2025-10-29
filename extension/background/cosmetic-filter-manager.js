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
    const url = new URL(details.url);
    const registrableDomain = psl.get(url.hostname);
    if (registrableDomain === null) {
      return;
    }
    const setting = await getSetting(registrableDomain, 'blocking', 'ads', true);
    if (!setting) {
      return;
    }
    const files = [
      'content_scripts/adblock_css/_default_.css',
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
  }, {urls: ["<all_urls>"]});
}