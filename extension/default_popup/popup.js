import psl from '../thirdparty/psl.mjs';

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

const updateSiteInfo = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab.url;
  const domain = psl.get(new URL(url).hostname);
  document.getElementById('domain').textContent = domain;
  document.getElementById('favicon').src = faviconURL(url);
}

await updateSiteInfo();