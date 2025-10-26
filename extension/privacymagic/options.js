import { setupSettingsUI } from '../common/settings-ui.js';
import { setupPrefsUI } from './prefs-ui.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';
import { resetAllSettingsToDefaults, ALL_DOMAINS } from '../common/settings.js';
import { THEME_CONFIG } from '../common/theme.js';

const setupIcon = async (iconString) => {
  document.getElementById('icon').textContent = iconString;
};

document.addEventListener('DOMContentLoaded', async () =>  {
  document.getElementById('reset-all').addEventListener('click', async () => {
    await resetAllPrefsToDefaults();
    await resetAllSettingsToDefaults(ALL_DOMAINS);
  });
  setupPrefsUI();
  setupSettingsUI(ALL_DOMAINS);
  await setupIcon(THEME_CONFIG.toolbarIcon);
});
