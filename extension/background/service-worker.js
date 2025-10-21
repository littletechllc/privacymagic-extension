import { generateIcon } from './icon-generator.js'
import { initializeDynamicRules } from './rules-generator.js'
import { setChromePrivacyPrefs } from './chrome-privacy-prefs.js'

const fetchJson = async (url) => {
  const response = await fetch(url);
  return response.json();
}

generateIcon()

const listOfSubDomains = (domain) => {
  const subDomains = [];
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    subDomains.push(parts.slice(i).join('.'));
  }
  return subDomains;
}

const injectCssForCosmeticFilters = () => {
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    const url = new URL(details.url);
    const subDomains = listOfSubDomains(url.hostname);
    const defaultText = chrome.runtime.getURL('content_scripts/adblock_css/_default_.css');
    const defaultResponse = await fetch(defaultText);
    const defaultCssText = await defaultResponse.text();
    for (const subDomain of subDomains) {
      const cssFile = `content_scripts/adblock_css/${subDomain}_.css`;
      const cssFileUrl = chrome.runtime.getURL(cssFile);
      try {
        const response = await fetch(cssFileUrl);
        console.log("response", response);
        if (response.ok) {
          const cssText = await response.text();
          chrome.scripting.insertCSS({
            target: {
              tabId: details.tabId,
              frameIds: [details.frameId]
            },
            css: cssText + "\n" + defaultCssText
          });
          console.log(`injected ${cssFile} for ${details.url}, frameId: ${details.frameId}, tabId: ${details.tabId}, text: ${cssText}`);
        }
      } catch (error) {
        // File doesn't exist, so ignore
      }

    }
  }, {urls: ["<all_urls>"]});
}

chrome.runtime.onInstalled.addListener(async function (details) {
  chrome.runtime.openOptionsPage()
  const t1 = performance.now();
  await initializeDynamicRules();
  const t2 = performance.now();
  console.log(`initializeDynamicRules took ${t2 - t1} milliseconds`);
  await setChromePrivacyPrefs()
  const t3 = performance.now();
  console.log(`setChromePrivacyPrefs took ${t3 - t2} milliseconds`);
  const contentBlockingDefinitionsUrl = chrome.runtime.getURL('rules/content-blocking-definitions.json');
  const t4 = performance.now();
  console.log(`fetchJson took ${t4 - t3} milliseconds`);
  injectCssForCosmeticFilters();
  //const contentBlockingDefinitions = await fetchJson(contentBlockingDefinitionsUrl);
  //console.log(contentBlockingDefinitions.length);
  //await chrome.scripting.registerContentScripts(contentBlockingDefinitions);
  const t5 = performance.now();
  console.log(`logNavigations took ${t5 - t4} milliseconds`);
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
  logRequestDomains();
});
