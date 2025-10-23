import { setupSettingsUI } from './settings.js';
import { setupPrefsUI } from './prefs.js';
import { generateToolbarIcon } from '../background/icon-generator.js';

const setupIcon = async (iconString) => {
  await generateToolbarIcon(iconString);
  document.getElementById('icon').textContent = iconString;
};

document.addEventListener('DOMContentLoaded', async () =>  {
  setupPrefsUI();
  setupSettingsUI('_GLOBAL_');
  await setupIcon('🪬');
});
