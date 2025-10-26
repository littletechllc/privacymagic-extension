import { generateToolbarIcon } from './icon-generator.js'
import { initializeDynamicRules, clearDynamicRules } from './rules-generator.js'

import psl from '../thirdparty/psl.mjs';
import { getSetting } from '../common/settings.js';

const injectCssForCosmeticFilters = () => {
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    const url = new URL(details.url);
    const registrableDomain = psl.get(url.hostname);
    const setting = await getSetting(registrableDomain, 'blocking', 'ads', true);
    if (!setting) {
      return;
    }
    chrome.scripting.insertCSS({
      target: {
        tabId: details.tabId,
        frameIds: [details.frameId]
      },
      [
        'content_scripts/adblock_css/_default_.css',
        `content_scripts/adblock_css/${registrableDomain}_.css`
      ]
    });
  }, {urls: ["<all_urls>"]});
}

chrome.runtime.onInstalled.addListener(async function (details) {
  await generateToolbarIcon('🅿️')
  await clearDynamicRules();
  //await chrome.runtime.openOptionsPage()
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
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
});
