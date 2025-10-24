import { setupSettingsUI } from './settings.js';
import { setupPrefsUI } from './prefs.js';
import { generateToolbarIcon } from '../background/icon-generator.js';
import { resetAllPrefsToDefaults } from '../utils/prefs.js';
import { resetAllSettingsToDefaults } from '../utils/settings.js';

const setupIcon = async (iconString) => {
  await generateToolbarIcon(iconString);
  document.getElementById('icon').textContent = iconString;
};

document.addEventListener('DOMContentLoaded', async () =>  {
  document.getElementById('reset-all').addEventListener('click', async () => {
    await resetAllPrefsToDefaults();
    await resetAllSettingsToDefaults('_GLOBAL_');
  });
  setupPrefsUI();
  setupSettingsUI('_GLOBAL_');
  await setupIcon('🪬');
});
