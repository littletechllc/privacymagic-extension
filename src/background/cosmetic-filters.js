/* global chrome */

import { registrableDomainFromUrl, logError } from '../common/util.js';
import { getSetting } from '../common/settings.js';

const tabIdToDomain = new Map();

const monitorDomainForTab = () => {
  /** @param {chrome.webNavigation.WebNavigationTransitionCallbackDetails} details */
  const listener = async ({ url, tabId, frameId }) => {
    try {
      if (frameId !== 0 && frameId !== undefined) {
        return;
      }
      const domain = registrableDomainFromUrl(url);
      tabIdToDomain.set(tabId, domain);
      console.log('tabIdToDomain:', tabIdToDomain.entries());
    } catch (error) {
      logError(error, 'error monitoring domain for tab', { url, tabId });
    }
  };
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

const DEFAULT_CSS_FILE = 'content_scripts/adblock_css/_default_.css';

/** @param {chrome.webNavigation.WebNavigationBaseCallbackDetails} details */
const handleCosmeticFilters = async (details) => {
  console.log('handleCosmeticFilters:', details);
  try {
    const files = [
      DEFAULT_CSS_FILE
    ];
    const registrableDomain = registrableDomainFromUrl(details.url);
    if (registrableDomain === null) {
      return;
    }
    const topLevelDomain = tabIdToDomain.get(details.tabId);
    if (topLevelDomain === undefined) {
      return;
    }
    const setting = await getSetting(topLevelDomain, 'ads');
    if (setting === false) {
      return;
    }
    const domainSpecificFile = `content_scripts/adblock_css/${registrableDomain}_.css`;
    if (await fileExists(domainSpecificFile)) {
      files.push(domainSpecificFile);
    }
    console.log('inserting CSS for cosmetic filters for', registrableDomain, files);
    await chrome.scripting.insertCSS({
      target: {
        tabId: details.tabId,
        frameIds: [details.frameId]
      },
      files
    });
    console.log('injected CSS for cosmetic filters for', registrableDomain, details.frameId, files);
  } catch (error) {
    if (error.message === `Frame with ID ${details.frameId} was removed.` ||
      error.message === `No tab with id: ${details.tabId}` ||
      error.message === `No frame with id ${details.frameId} in tab with id ${details.tabId}`) {
      console.log('ignoring error injecting CSS for cosmetic filters', error.message);
      // Ignore these errors.
      return;
    }
    logError(error, 'error injecting CSS for cosmetic filters', details);
  }
};

export const injectCssForCosmeticFilters = () => {
  monitorDomainForTab();
  chrome.webNavigation.onBeforeNavigate.addListener(details => {
    handleCosmeticFilters(details);
    return { cancel: false };
  });
};
