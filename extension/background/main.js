import { setToolbarIcon } from '../common/toolbar-icon.js'
import { initializeDynamicRules, clearDynamicRules } from './rules-generator.js'
import { injectCssForCosmeticFilters } from './cosmetic-filter-manager.js';
import { THEME_CONFIG } from '../common/theme.js';
import { setupContentScripts } from './content-scripts.js';


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
  setupContentScripts();
  const t6 = performance.now();
  console.log(`setupContentScripts took ${t6 - t5} milliseconds`);
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
});
