import { setupSettingsUI } from '../common/settings-ui.js';
import { setupPrefsUI } from './prefs-ui.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';
import { resetAllSettingsToDefaults, ALL_DOMAINS } from '../common/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    document.getElementById('reset-all').addEventListener('click', async () => {
      try {
        await resetAllPrefsToDefaults();
        await resetAllSettingsToDefaults(ALL_DOMAINS);
      } catch (error) {
        console.error('error resetting all prefs and settings to defaults', error);
      }
    });
    setupPrefsUI();
    setupSettingsUI(ALL_DOMAINS);
  } catch (error) {
    console.error('error setting up options page', error);
  }
});
