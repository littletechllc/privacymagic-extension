/* global chrome */

import { setupSettingsUI } from '../common/settings-ui.js';
import { setupPrefsUI } from './prefs-ui.js';
import { resetAllPrefsToDefaults } from '../common/prefs.js';
import { resetAllSettingsToDefaults, ALL_DOMAINS } from '../common/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('reset-all').addEventListener('click', async () => {
    await resetAllPrefsToDefaults();
    await resetAllSettingsToDefaults(ALL_DOMAINS);
  });
  setupPrefsUI();
  setupSettingsUI(ALL_DOMAINS);
});
