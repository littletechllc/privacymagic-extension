import { PRIVACY_SETTINGS_CONFIG, SETTINGS_KEY_PREFIX } from '../common/settings.js';
import { getLocalizedText } from '../common/i18n.js';
import { createToggle } from '../common/toggle.js';
import { storage } from '../common/storage.js';

const bindToggleToStorage = async (toggle, store, keyPath, defaultValue) => {
  const storageValue = await store.get(keyPath);
  const input = toggle.querySelector('input');
  input.checked = storageValue !== undefined ? storageValue : defaultValue;
  input.addEventListener('change', (event) => {
    const value = event.target.checked;
    if (value === defaultValue) {
      store.remove(keyPath);
    } else {
      store.set(keyPath, value);
    }
  });
  store.listenForChanges(keyPath, (value) => {
    input.checked = value !== undefined ? value : defaultValue;
  });
}

const createToggleCategory = async (store, domain, categoryId, settingIds) => {
  const category = document.createElement('div');
  category.id = categoryId;
  category.className = 'toggle-box';
  const categoryTitle = document.createElement('h2');
  categoryTitle.textContent = getLocalizedText(categoryId);
  category.appendChild(categoryTitle);
  settingIds.forEach(async (settingId) => {
    const toggle = await createToggle(settingId);
    const keyPath = [SETTINGS_KEY_PREFIX, domain, categoryId, settingId];
    await bindToggleToStorage(toggle, store, keyPath, /*defaultValue*/ true);
    category.appendChild(toggle);
  });
  return category;
};

export const setupSettingsUI = async (domain) => {
  const settingsContainer = document.getElementById('settings');
  if (!settingsContainer) {
    throw new Error('Settings container not found');
  }
  settingsContainer.innerHTML = `<h1>Privacy Magic Protections</h1>`;
  for (const [categoryId, settingConfigs] of Object.entries(PRIVACY_SETTINGS_CONFIG)) {
    const toggleCategory = await createToggleCategory(storage.local, domain, categoryId, Object.keys(settingConfigs));
    settingsContainer.appendChild(toggleCategory);
  }
};

