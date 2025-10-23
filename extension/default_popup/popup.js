import psl from '../thirdparty/psl.mjs';
import { setupSettingsUI } from '../privacymagic/settings.js';

document.getElementById('settingsButton').addEventListener('click', function() {
  console.log('settingsButton clicked');
  chrome.runtime.openOptionsPage();
});

const faviconURL = (pageUrl) => {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "24");
  return url.toString();
}

const getDomainForCurrentTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab.url;
  return psl.get(new URL(url).hostname);
}

const updateSiteInfo = async (domain) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab.url;
  document.getElementById('domain').textContent = domain;
  document.getElementById('favicon').src = faviconURL(url);
}

const domain = await getDomainForCurrentTab();
await updateSiteInfo(domain);
await setupSettingsUI(domain);