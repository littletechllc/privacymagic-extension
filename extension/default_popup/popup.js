/* global chrome, punycode */

import { setupSettingsUI } from '../common/settings-ui.js';
import { registrableDomainFromUrl } from '../common/util.js';

const setupOptionsButton = () => {
  document.getElementById('optionsButton').addEventListener('click', () => {
    try {
      console.log('optionsButton clicked');
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('error opening options page', error);
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
  document.getElementById('favicon').src = faviconURL(url);
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const domain = await getDomainForCurrentTab();
    setupOptionsButton();
    await updateSiteInfo(domain);
    await setupSettingsUI(domain);
  } catch (error) {
    console.error('error responding to DOMContentLoaded on current tab', error);
  }
});
