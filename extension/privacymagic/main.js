import { setupSettingsUI } from './settings.js';
import { setupPrefsUI } from './prefs.js';
import { generateToolbarIcon } from '../background/icon-generator.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';
import { resetAllSettingsToDefaults, ALL_DOMAINS } from '../common/settings.js';

const setupIcon = async (iconString) => {
  await generateToolbarIcon(iconString);
  document.getElementById('icon').textContent = iconString;
};

document.addEventListener('DOMContentLoaded', async () =>  {
  document.getElementById('reset-all').addEventListener('click', async () => {
    await resetAllPrefsToDefaults();
    await resetAllSettingsToDefaults(ALL_DOMAINS);
  });
  setupPrefsUI();
  setupSettingsUI(ALL_DOMAINS);
  await setupIcon('🪬');
});
