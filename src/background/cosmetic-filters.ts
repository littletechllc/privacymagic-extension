import { registrableDomainFromUrl, logError } from '../common/util';
import { getSetting } from '../common/settings';

const fileExists = async (path: string): Promise<boolean> => {
  try {
    const url = chrome.runtime.getURL(path);
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    return false;
  }
};

let listener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => Promise<void>) | null = null;

export const injectCssForCosmeticFilters = () => {
  if (listener !== null) {
    chrome.webNavigation.onCommitted.removeListener(listener);
    listener = null;
  }
  listener = async (details) => {
    try {
      let url = details.url;
      if (details.frameId !== 0 && details.frameId !== undefined) {
        const tab = await chrome.tabs.get(details.tabId);
        if (tab.url) {
          url = tab.url;
        }
      }
      const topLevelDomain = registrableDomainFromUrl(url);
      if (topLevelDomain === null) {
        return;
      }
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
      if (error instanceof Error) {
        if (error.message === `Frame with ID ${details.frameId} was removed.` ||
            error.message === `No tab with id: ${details.tabId}` ||
            error.message === `No frame with id ${details.frameId} in tab with id ${details.tabId}`) {
          // Ignore these errors.
          return;
        }
        logError(error, 'error injecting CSS for cosmetic filters', details);
      }
    }
  };
  chrome.webNavigation.onCommitted.addListener(listener);
};
