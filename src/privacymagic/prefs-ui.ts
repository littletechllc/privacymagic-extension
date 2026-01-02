import { PRIVACY_PREFS_CONFIG, getPref, setPref, listenForPrefChanges } from '../common/prefs.js';
import { createToggle } from '../common/toggle.js';
import { logError } from '../common/util.js';

const bindPrefToCheckbox = async (toggle, prefName, inverted) => {
  const value = await getPref(prefName);
  const input = toggle.querySelector('input');
  input.checked = inverted ? !value : value;
  input.addEventListener('change', (event) => {
    try {
      const value = event.target.checked;
      setPref(prefName, inverted ? !value : value);
    } catch (error) {
      logError(error, 'error responding to click on pref checkbox', event);
    }
  });
  listenForPrefChanges(prefName, (value) => {
    input.checked = inverted ? !value : value;
  });
};

export const setupPrefsUI = async () => {
  const prefsContainer = document.getElementById('prefs');
  if (!prefsContainer) {
    throw new Error('Prefs container not found');
  }
  // Clear container and add title
  prefsContainer.innerHTML = '<h1>Browser Preferences</h1>';
  // Create toggles for each preference
  for (const [prefName, { locked, inverted }] of Object.entries(PRIVACY_PREFS_CONFIG)) {
    const toggle = await createToggle(prefName, locked);
    await bindPrefToCheckbox(toggle, prefName, inverted);
    prefsContainer.appendChild(toggle);
  }
};
