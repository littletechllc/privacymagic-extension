import { setupSettingsUI } from '../common/settings-ui';
import { logError } from '../common/util';
import punycode from 'punycode-npm';

const setupOptionsButton = () => {
  document.getElementById('optionsButton')?.addEventListener('click', (event) => {
    try {
      console.log('optionsButton clicked');
      chrome.runtime.openOptionsPage();
    } catch (error) {
      logError(error, 'error opening options page', event);
    }
  });
};

const faviconURL = (pageUrl: string) => {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '24');
  return url.toString();
};

const updateSiteInfo = async (domain: string) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab.url;
  document.getElementById('domain')!.textContent = punycode.toUnicode(domain);
  const favicon = document.getElementById('favicon') as HTMLImageElement | null;
  if (favicon && url) {
    favicon.src = faviconURL(url);
  }
};

document.addEventListener('DOMContentLoaded', async (event) => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getDomainForCurrentTab'
    });
    if (!response.success) {
      return;
    }
    const domain = response.domain;
    setupOptionsButton();
    await updateSiteInfo(domain);
    await setupSettingsUI(domain);
  } catch (error) {
    logError(error, 'error responding to DOMContentLoaded on current tab', event);
  }
});
