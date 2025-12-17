/* global chrome */

import { setupSettingsUI } from '../common/settings-ui.js';
import { registrableDomainFromUrl, logError } from '../common/util.js';
import punycode from '../thirdparty/punycode.js';

const setupOptionsButton = () => {
  document.getElementById('optionsButton').addEventListener('click', (event) => {
    try {
      console.log('optionsButton clicked');
      chrome.runtime.openOptionsPage();
    } catch (error) {
      logError(error, 'error opening options page', event);
    }
  });
};

const faviconURL = (pageUrl) => {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '24');
  return url.toString();
};

const getDomainForCurrentTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab.url;
  return registrableDomainFromUrl(url);
};

const updateSiteInfo = async (domain) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab.url;
  document.getElementById('domain').textContent = punycode.toUnicode(domain);
  const favicon = /** @type {HTMLImageElement | null} */ (document.getElementById('favicon'));
  if (favicon) {
    favicon.src = faviconURL(url);
  }
};

document.addEventListener('DOMContentLoaded', async (event) => {
  try {
    const domain = await getDomainForCurrentTab();
    setupOptionsButton();
    await updateSiteInfo(domain);
    await setupSettingsUI(domain);
  } catch (error) {
    logError(error, 'error responding to DOMContentLoaded on current tab', event);
  }
});
