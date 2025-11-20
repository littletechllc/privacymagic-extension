/* global chrome */

import { SETTINGS_KEY_PREFIX, ALL_DOMAINS } from '../common/settings.js';
import { getLocalizedText } from '../common/i18n.js';
import { createToggle } from '../common/toggle.js';
import { storage } from '../common/storage.js';
import { logError } from '../common/util.js';

const PRIVACY_SETTINGS_CONFIG = {
  blocking: [
    'ads'
  ],
  fingerprinting: [
    // 'audio',
    'battery',
    'cpu',
    'device',
    'disk',
    'display',
    // 'fonts',
    'gpu',
    'keyboard',
    'language',
    'math',
    'memory',
    'network',
    'screen',
    'timezone',
    'timer',
    'touch',
    'useragent'
  ],
  navigation: [
    'gpc',
    'queryParameters',
    'referrerPolicy',
    'windowName'
  ],
  leakyFeatures: [
    'iframe',
    'serviceWorker',
    'sharedStorage',
    'worker'
  ]
};

const sortBy = (array, keyFn) => {
  return array.sort((a, b) => {
    const aKey = keyFn(a);
    const bKey = keyFn(b);
    return aKey.localeCompare(bKey);
  });
};

const bindToggleToStorage = async (toggle, store, keyPath, defaultValue) => {
  const storageValue = await store.get(keyPath);
  const input = toggle.querySelector('input');
  input.checked = storageValue !== undefined ? storageValue : defaultValue;
  store.listenForChanges(keyPath, (value) => {
    input.checked = value !== undefined ? value : defaultValue;
  });
};

const createToggleCategory = async (store, domain, settingIds, categoryId) => {
  const category = document.createElement('div');
  category.id = categoryId;
  category.className = 'toggle-box';
  const categoryTitle = document.createElement('h2');
  categoryTitle.textContent = getLocalizedText(categoryId);
  category.appendChild(categoryTitle);
  const sortedSettingIds = sortBy(settingIds, (settingId) => getLocalizedText(settingId));
  for (const settingId of sortedSettingIds) {
    const toggle = await createToggle(settingId);
    const keyPath = [SETTINGS_KEY_PREFIX, domain, settingId];
    await bindToggleToStorage(toggle, store, keyPath, /* defaultValue */ true);
    category.appendChild(toggle);
  }
  return category;
};

// Add a listener that reloads the tab when a per-site toggle is clicked.
const setupInputListeners = (domain) => {
  document.querySelectorAll('#settings input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', async (event) => {
      try {
        const settingId = event.target.id;
        const response = await chrome.runtime.sendMessage({
          type: 'updateSetting',
          domain,
          settingId,
          value: event.target.checked
        });
        console.log('sendMessage response:', response);
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0].id;
        await chrome.tabs.reload(tabId);
      } catch (error) {
        logError(error, 'error updating setting', event);
      }
    });
  });
};

export const setupSettingsUI = async (domain) => {
  const settingsContainer = document.getElementById('settings');
  if (!settingsContainer) {
    throw new Error('Settings container not found');
  }
  settingsContainer.innerHTML = '<h1>Privacy Magic Protections</h1>';
  for (const [categoryId, settingIds] of Object.entries(PRIVACY_SETTINGS_CONFIG)) {
    const toggleCategory = await createToggleCategory(storage.local, domain, settingIds, categoryId);
    settingsContainer.appendChild(toggleCategory);
  }
  if (domain !== ALL_DOMAINS) {
    setupInputListeners(domain);
  }
};
