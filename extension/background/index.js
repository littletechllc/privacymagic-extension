/* global chrome */

import { injectCssForCosmeticFilters } from './cosmetic-filters.js';
import { updateContentScripts, setupContentScripts } from './content-scripts.js';
import { setSetting } from '../common/settings.js';
import { setupNetworkRules, updateTopLevelNetworkRule } from './network.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';
import { registrableDomainFromUrl, logError } from '../common/util.js';
import { createHttpWarningNetworkRule, updateHttpWarningNetworkRuleException } from './http-warning.js';
import { setupExceptionsToStaticRules } from './blocker-exceptions.js';

const blockAutocomplete = async () => {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [400],
    addRules: [
      {
        id: 400,
        action: { type: 'block' },
        condition: {
          urlFilter: 'https://www.google.com/complete/*'
        }
      }
    ]
  });
};

const updateSetting = async (domain, settingId, value) => {
  await setSetting(domain, settingId, value);
  await updateContentScripts(domain, settingId, value);
  await updateTopLevelNetworkRule(domain, settingId, value);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.type === 'updateSetting') {
      updateSetting(message.domain, message.settingId, message.value).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        logError(error, 'error updating setting', message);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Indicates we will send a response asynchronously
    }
    if (message.type === 'addHttpWarningNetworkRuleException') {
      const domain = registrableDomainFromUrl(message.url);
      console.log('adding exception to http warning network rule for domain:', domain, 'value:', message.value);
      updateHttpWarningNetworkRuleException(domain, message.value).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        logError(error, 'error adding exception to http warning network rule', message);
        sendResponse({ success: false, error: error.message });
      });
      sendResponse({ success: true });
    }
    return false;
  } catch (error) {
    logError(error, 'error onMessage', message);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

let initializedCalled = false;

const initializeExtension = async () => {
  if (initializedCalled) {
    return;
  }
  initializedCalled = true;
  injectCssForCosmeticFilters();
  await setupContentScripts();
  await setupNetworkRules();
  await setupExceptionsToStaticRules();
  await createHttpWarningNetworkRule();
  await blockAutocomplete();
  console.log('Extension initialized');
};

chrome.runtime.onInstalled.addListener(async function (details) {
  try {
    console.log('onInstalled details:', details);
    await initializeExtension();
    await resetAllPrefsToDefaults();
  } catch (error) {
    // TODO: Show user a notification that the extension failed to install.
    logError(error, 'error onInstalled', details);
  }
});

chrome.runtime.onStartup.addListener(async (details) => {
  try {
    console.log('onStartup details:', details);
    await initializeExtension();
  } catch (error) {
    // TODO: Show user a notification that the extension failed to start.
    logError(error, 'error onStartup', details);
  }
});

initializeExtension().then(() => {
  console.log('background script loaded');
}).catch((error) => {
  logError(error, 'error initializing extension');
});
