import { setToolbarIcon } from '../common/toolbar-icon.js'
import { initializeDynamicRules, clearDynamicRules } from './rules-generator.js'
import psl from '../thirdparty/psl.mjs';
import { getSetting } from '../common/settings.js';
import { THEME_CONFIG } from '../common/theme.js';

const addContentScripts = () => {
  chrome.scripting.registerContentScripts(
    [
      {
        id: 'window_name',
        js: ['content_scripts/window_name.js'],
        matches: ['<all_urls>'],
        allFrames: true,
        matchOriginAsFallback: true,
        runAt: 'document_start',
        world: 'MAIN'
      }
    ]
  );
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

const injectCssForCosmeticFilters = () => {
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    const url = new URL(details.url);
    const registrableDomain = psl.get(url.hostname);
    if (registrableDomain === null) {
      return;
    }
    const setting = await getSetting(registrableDomain, 'blocking', 'ads', true);
    if (!setting) {
      return;
    }
    const files = [
      'content_scripts/adblock_css/_default_.css',
    ];
    const domainSpecificFile = `content_scripts/adblock_css/${registrableDomain}_.css`;
    if (await fileExists(domainSpecificFile)) {
      files.push(domainSpecificFile);
    }
    console.log(`insertCSS for ${registrableDomain}`);
    chrome.scripting.insertCSS({
      target: {
        tabId: details.tabId,
        frameIds: [details.frameId]
      },
      files
    });
  }, {urls: ["<all_urls>"]});
}

chrome.runtime.onInstalled.addListener(async function (details) {
  await setToolbarIcon(THEME_CONFIG.toolbarIcon)
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
  addContentScripts();
  const t6 = performance.now();
  console.log(`addContentScripts took ${t6 - t5} milliseconds`);
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
});
