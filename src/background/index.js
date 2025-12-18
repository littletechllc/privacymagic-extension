/* global chrome */

import { injectCssForCosmeticFilters } from './cosmetic-filters.js';
import { updateContentScripts, setupContentScripts } from './content-scripts.js';
import { setSetting } from '../common/settings.js';
import { setupNetworkRules, updateTopLevelNetworkRule } from './network.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';
import { createHttpWarningNetworkRule, updateHttpWarningNetworkRuleException } from './http-warning.js';
import { setupExceptionsToStaticRules } from './blocker-exceptions.js';
import { handleRemoteCssRequests } from './remote-css.js';
import { logError } from '../common/util.js';

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

const logMatchingRulesInDevMode = () => {
  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
      async ({ request, rule }) => {
        let ruleContent;
        if (rule.rulesetId === '_session') {
          const rules = await chrome.declarativeNetRequest.getSessionRules({
            ruleIds: [rule.ruleId]
          });
          ruleContent = rules[0];
        }
        if (rule.rulesetId === '_dynamic') {
          const rules = await chrome.declarativeNetRequest.getDynamicRules({
            ruleIds: [rule.ruleId]
          });
          ruleContent = rules[0];
        }
        console.log('rule matched debug:', { request, rule, ruleContent });
      }
    );
  }
};

const testHttpBehavior = async () => {
  chrome.webRequest.onBeforeRequest.addListener(async (details) => {
    console.log('onBeforeRequest debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onBeforeSendHeaders.addListener(async (details) => {
    console.log('onBeforeSendHeaders debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onSendHeaders.addListener(async (details) => {
    console.log('onSendHeaders debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onHeadersReceived.addListener(async (details) => {
    console.log('onHeadersReceived debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onAuthRequired.addListener(async (details) => {
    console.log('onAuthRequired debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onBeforeRedirect.addListener(async (details) => {
    console.log('onBeforeRedirect debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onResponseStarted.addListener(async (details) => {
    console.log('onResponseStarted debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onCompleted.addListener(async (details) => {
    console.log('onCompleted debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webRequest.onErrorOccurred.addListener(async (details) => {
    console.log('onErrorOccurred debug:', details);
    return { cancel: false };
  }, { urls: ['<all_urls>'], types: ['main_frame'] });
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    console.log('onBeforeNavigate debug:', details);
    return { cancel: false };
  });
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    console.log('onCommitted debug:', details);
    return { cancel: false };
  });
  chrome.webNavigation.onDOMContentLoaded.addListener(async (details) => {
    console.log('onDOMContentLoaded debug:', details);
    return { cancel: false };
  });
  chrome.webNavigation.onCompleted.addListener(async (details) => {
    console.log('onCompleted debug:', details);
    return { cancel: false };
  });
  chrome.webNavigation.onErrorOccurred.addListener(async (details) => {
    console.log('onErrorOccurred debug:', details);
    return { cancel: false };
  });
  chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    console.log('onHistoryStateUpdated debug:', details);
    return { cancel: false };
  });
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(async (details) => {
    console.log('onReferenceFragmentUpdated debug:', details);
    return { cancel: false };
  });
};

const clearRules = async () => {
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: sessionRules.map(rule => rule.id)
  });
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: dynamicRules.map(rule => rule.id)
  });
  console.log('cleared rules');
};

const initializeExtension = async () => {
  await clearRules();
  injectCssForCosmeticFilters();
  await setupContentScripts();
  await setupNetworkRules();
  await setupExceptionsToStaticRules();
  await createHttpWarningNetworkRule();
  await blockAutocomplete();
  await handleRemoteCssRequests();
  logMatchingRulesInDevMode();
  await testHttpBehavior();
  console.log('Extension initialized');
};

chrome.runtime.onInstalled.addListener(async function (details) {
  try {
    console.log('onInstalled details:', details);
    await resetAllPrefsToDefaults();
    await initializeExtension();
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
