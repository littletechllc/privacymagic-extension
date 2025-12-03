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

const handleMessage = async (message, sender, sendResponse) => {
  try {
    if (message.type === 'updateSetting') {
      await updateSetting(message.domain, message.settingId, message.value);
      sendResponse({ success: true });
    } else if (message.type === 'addHttpWarningNetworkRuleException') {
      await updateHttpWarningNetworkRuleException(message.url, message.value);
      sendResponse({ success: true });
    } else if (message.type === 'getRemoteStyleSheetContent') {
      const response = await fetch(message.href);
      const content = await response.text();
      sendResponse({ success: true, content });
    } else {
      throw new Error('unknown message type: ' + message.type);
    }
  } catch (error) {
    logError(error, 'error handling message', message);
    sendResponse({ success: false, error: error.message });
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Asynchronously handle the message. We ignore the returned Promise of handleMessage.
  handleMessage(message, sender, sendResponse);
  // Return true to indicate that handleMessage will send a response asynchronously.
  return true;
});

const blockCssRequests = async () => {
  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [600],
    addRules: [
      {
        id: 600,
        priority: 10,
        action: {
          type: 'block'
        },
        condition: {
          resourceTypes: ['stylesheet']
        }
      }
    ]
  });
};

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
  await blockCssRequests();
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
