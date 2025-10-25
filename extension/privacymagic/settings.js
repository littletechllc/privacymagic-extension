import { PRIVACY_SETTINGS_CONFIG } from '../utils/settings.js';
import { getLocalizedText } from '../utils/i18n.js';
import { createCheckboxBoundToStorage } from '../utils/checkbox.js';
import { storage } from '../utils/storage.js';

const createToggleCategory = async (storage, domain, categoryId, settingIds) => {
  const category = document.createElement('div');
  category.id = categoryId;
  category.className = 'toggle-box';
  const categoryTitle = document.createElement('h2');
  categoryTitle.textContent = getLocalizedText(categoryId); 
  category.appendChild(categoryTitle);
  settingIds.forEach(async (settingId) => {
    const checkbox = await createCheckboxBoundToStorage(
      storage, ["_SETTINGS_", domain, categoryId, settingId], true);
    category.appendChild(checkbox);
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

