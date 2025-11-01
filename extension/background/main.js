/* global chrome */

import { setToolbarIcon } from '../common/toolbar-icon.js';
import { clearDynamicRules } from './rules-generator.js';
import { injectCssForCosmeticFilters } from './cosmetic-filter-manager.js';
import { THEME_CONFIG } from '../common/theme.js';
import { updateContentScripts, setupContentScripts } from './content-scripts.js';
import { setSetting } from '../common/settings.js';
import { setupHeaderRules, updateTopLevelHeaderRule } from './headers.js';

const updateSetting = async (domain, settingId, value) => {
  await setSetting(domain, settingId, value);
  await updateContentScripts(domain, settingId, value);
  await updateTopLevelHeaderRule(domain, settingId, value);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateSetting') {
    updateSetting(message.domain, message.settingId, message.value)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates we will send a response asynchronously
  }
  return false;
});

let initialized = false;

const initializeExtension = async () => {
  if (initialized) {
    return;
  }
  await setToolbarIcon(THEME_CONFIG.toolbarIcon);
  await clearDynamicRules();
  // await chrome.runtime.openOptionsPage()
  const t1 = performance.now();
  // await initializeDynamicRules();
  const t2 = performance.now();
  console.log(`initializeDynamicRules took ${t2 - t1} milliseconds`);
  // const contentBlockingDefinitionsUrl = chrome.runtime.getURL('rules/content-blocking-definitions.json');
  const t4 = performance.now();
  // console.log(`fetchJson took ${t4 - t3} milliseconds`);
  injectCssForCosmeticFilters();
  const t5 = performance.now();
  console.log(`injectCssForCosmeticFilters took ${t5 - t4} milliseconds`);
  await setupContentScripts();
  const t6 = performance.now();
  console.log(`setupContentScripts took ${t6 - t5} milliseconds`);
  await setupHeaderRules();
  console.log('Extension initialized');
  initialized = true;
};

chrome.runtime.onInstalled.addListener(async function (details) {
  console.log('onInstalled details:', details);
  await initializeExtension();
});

chrome.runtime.onStartup.addListener(async (details) => {
  console.log('onStartup details:', details);
  await initializeExtension();
});
