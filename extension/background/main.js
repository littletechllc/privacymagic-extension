/* global chrome */

import { setToolbarIcon } from '../common/toolbar-icon.js';
import { injectCssForCosmeticFilters } from './cosmetic-filter-manager.js';
import { THEME_CONFIG } from '../common/theme.js';
import { updateContentScripts, setupContentScripts } from './content-scripts.js';
import { setSetting } from '../common/settings.js';
import { setupHeaderRules, updateTopLevelHeaderRule } from './headers.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';

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
  injectCssForCosmeticFilters();
  await setupContentScripts();
  await setupHeaderRules();
  console.log('Extension initialized');
  initialized = true;
};

chrome.runtime.onInstalled.addListener(async function (details) {
  console.log('onInstalled details:', details);
  await initializeExtension();
  await resetAllPrefsToDefaults();
});

chrome.runtime.onStartup.addListener(async (details) => {
  console.log('onStartup details:', details);
  await initializeExtension();
});
