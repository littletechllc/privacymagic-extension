import { setupSettingsUI } from '../common/settings-ui';
import { setupPrefsUI } from './prefs-ui';
import { resetAllPrefsToDefaults } from '../common/prefs';
import { resetAllSettingsToDefaults, ALL_DOMAINS } from '../common/settings';
import { logError } from '../common/util';

document.addEventListener('DOMContentLoaded', async (event) => {
  try {
    document.getElementById('reset-all').addEventListener('click', async () => {
      try {
        await resetAllPrefsToDefaults();
        await resetAllSettingsToDefaults(ALL_DOMAINS);
      } catch (error) {
        logError(error, 'error resetting all prefs and settings to defaults', event);
      }
    });
    setupPrefsUI();
    setupSettingsUI(ALL_DOMAINS);
  } catch (error) {
    logError(error, 'error setting up options page', event);
  }
});
