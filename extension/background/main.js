/* global chrome */

import { injectCssForCosmeticFilters } from './cosmetic-filters.js';
import { updateContentScripts, setupContentScripts } from './content-scripts.js';
import { setSetting } from '../common/settings.js';
import { setupNetworkRules, updateTopLevelNetworkRule } from './network.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';

const updateSetting = async (domain, settingId, value) => {
  await setSetting(domain, settingId, value);
  await updateContentScripts(domain, settingId, value);
  await updateTopLevelNetworkRule(domain, settingId, value);
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
  injectCssForCosmeticFilters();
  await setupContentScripts();
  await setupNetworkRules();
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
