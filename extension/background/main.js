import { generateToolbarIcon } from './icon-generator.js'
import { initializeDynamicRules, clearDynamicRules } from './rules-generator.js'
import { resetAllPrefsToDefaults} from '../common/prefs.js'
const fetchJson = async (url) => {
  const response = await fetch(url);
  return response.json();
}

await generateToolbarIcon('🅿️')

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
          const css = await response.text();
          chrome.scripting.insertCSS({
            target: {
              tabId: details.tabId,
              frameIds: [details.frameId]
            },
            css
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
  await clearDynamicRules();
  chrome.runtime.openOptionsPage()
  const t1 = performance.now();
  await initializeDynamicRules();
  const t2 = performance.now();
  console.log(`initializeDynamicRules took ${t2 - t1} milliseconds`);
  //const contentBlockingDefinitionsUrl = chrome.runtime.getURL('rules/content-blocking-definitions.json');
  const t4 = performance.now();
  //console.log(`fetchJson took ${t4 - t3} milliseconds`);
  injectCssForCosmeticFilters();
  const t5 = performance.now();
  console.log(`injectCssForCosmeticFilters took ${t5 - t4} milliseconds`);
  const t6 = performance.now();
  console.log('registering content scripts');
  await chrome.scripting.registerContentScripts([
    {
      id: 'adblock_css_defaults',
      css: ['content_scripts/adblock_css/_default_.css'],
      matches: ['<all_urls>'],
      allFrames: true,
      runAt: 'document_start',
      world: 'MAIN',
      matchOriginAsFallback: true
    }
  ]);
  const t7 = performance.now();
  console.log(`registerContentScripts took ${t7 - t6} milliseconds`);
  //const contentBlockingDefinitions = await fetchJson(contentBlockingDefinitionsUrl);
  //console.log(contentBlockingDefinitions.length);
  //await chrome.scripting.registerContentScripts(contentBlockingDefinitions);
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
  //logRequestDomains();
});
