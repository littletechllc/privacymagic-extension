import { PRIVACY_SETTINGS_CONFIG, SETTINGS_KEY_PREFIX, ALL_DOMAINS } from '../common/settings.js';
import { getLocalizedText } from '../common/i18n.js';
import { createToggle } from '../common/toggle.js';
import { storage } from '../common/storage.js';

const bindToggleToStorage = async (toggle, store, keyPath, defaultValue) => {
  const storageValue = await store.get(keyPath);
  const input = toggle.querySelector('input');
  input.checked = storageValue !== undefined ? storageValue : defaultValue;
  store.listenForChanges(keyPath, (value) => {
    input.checked = value !== undefined ? value : defaultValue;
  });
}

const createToggleCategory = async (store, domain, settingIds, categoryId) => {
  const category = document.createElement('div');
  category.id = categoryId;
  category.className = 'toggle-box';
  const categoryTitle = document.createElement('h2');
  categoryTitle.textContent = getLocalizedText(categoryId);
  category.appendChild(categoryTitle);
  for (const settingId of settingIds) {
    const toggle = await createToggle(settingId);
    const keyPath = [SETTINGS_KEY_PREFIX, domain, settingId];
    await bindToggleToStorage(toggle, store, keyPath, /*defaultValue*/ true);
    category.appendChild(toggle);
  }
  return category;
};

// Add a listener that reloads the tab when a per-site toggle is clicked.
const setupInputListeners = (domain) => {
  document.querySelectorAll('#settings input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', async (event) => {
      const settingId = event.target.id;
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'updateSetting',
          domain,
          settingId,
          value: event.target.checked,
        });
        console.log('sendMessage response:', response);
      } catch (error) {
        console.error('sendMessage error:', error);
      }
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0].id;
      await chrome.tabs.reload(tabId);
    });
  });
};

export const setupSettingsUI = async (domain) => {
  const settingsContainer = document.getElementById('settings');
  if (!settingsContainer) {
    throw new Error('Settings container not found');
  }
  settingsContainer.innerHTML = `<h1>Privacy Magic Protections</h1>`;
  const settingsForCategory = {};
  for (const [settingId, settingConfig] of Object.entries(PRIVACY_SETTINGS_CONFIG)) {
    settingsForCategory[settingConfig.category] ||= [];
    settingsForCategory[settingConfig.category].push(settingId);
  }
  for (const [categoryId, settingIds] of Object.entries(settingsForCategory)) {
    const toggleCategory = await createToggleCategory(storage.local, domain, settingIds, categoryId);
    settingsContainer.appendChild(toggleCategory);
  }
  if (domain !== ALL_DOMAINS) {
    setupInputListeners(domain);
  }
};

