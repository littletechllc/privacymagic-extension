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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    if (message.type === 'updateSetting') {
      await updateSetting(message.domain, message.settingId, message.value);
      sendResponse({ success: true });
      return true; // Indicates we will send a response asynchronously
    }
    return false;
  } catch (error) {
    console.error('error onMessage', message, sender, error);
    sendResponse({ success: false, error: error.message });
  }
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
  try {
    console.log('onInstalled details:', details);
    await initializeExtension();
    await resetAllPrefsToDefaults();
  } catch (error) {
    // TODO: Show user a notification that the extension failed to install.
    console.error('error onInstalled', details, error);
  }
});

chrome.runtime.onStartup.addListener(async (details) => {
  try {
    console.log('onStartup details:', details);
    await initializeExtension();
  } catch (error) {
    // TODO: Show user a notification that the extension failed to start.
    console.error('error onStartup', details, error);
  }
});
