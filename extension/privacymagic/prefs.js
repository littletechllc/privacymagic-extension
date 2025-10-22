import { PRIVACY_PREFS_CONFIG, getPref, setPref, listenForPrefChanges, resetAllPrefsToDefaults } from '../utils/prefs.js';

const setCheckboxValue = (prefName, value) => {
  const checkbox = document.getElementById(prefName);
  if (!checkbox) {
    console.log(`Checkbox ${prefName} not found`);
    return;
  }
  checkbox.checked = value;
  console.log(`Set checkbox ${prefName} to value ${value}`);
};

const listenForCheckboxChanges = (prefName, callback) => {
  const checkbox = document.getElementById(prefName);
  if (!checkbox) {
    throw new Error(`Checkbox ${prefName} not found`);
  }
  checkbox.addEventListener('change', (event) => {
    callback(event.target.checked);
  });
};

const listenForResetButtonClick = (callback) => {
  const resetButton = document.getElementById('reset-prefs');
  if (!resetButton) {
    throw new Error('Reset button not found');
  }
  resetButton.addEventListener('click', callback);
};

const getLocalizedText = (key) => {
  const message = chrome.i18n.getMessage(key);
  console.log(`Getting localized text for key "${key}":`, message);
  if (!message) {
    console.warn(`No localized text found for key "${key}". Available keys:`, Object.keys(chrome.i18n.getAcceptLanguages ? {} : {}));
  }
  return message || key; // Fallback to key if message not found
};

const initializePrefsUI = () => {
  const prefsContainer = document.getElementById('prefs');
  if (!prefsContainer) {
    throw new Error('Prefs container not found');
  }
  prefsContainer.innerHTML = Object.entries(PRIVACY_PREFS_CONFIG)
    .map(([checkboxId, { locked }]) => {
      const label = getLocalizedText(checkboxId);
      return `
        <label class='${locked ? 'locked' : ''}'>
          <input type="checkbox" id="${checkboxId}" ${locked ? 'disabled' : ''}>
          ${label}
        </label>
      `;
    })
    .join('\n') + `
      <button type="button" id="reset-prefs">Reset to Defaults</button>
    `;
};

const bindPrefToCheckbox = async (checkboxId, prefName, inverted) => {
  const value = await getPref(prefName);
  setCheckboxValue(checkboxId, inverted ? !value : value);
  listenForCheckboxChanges(checkboxId, (newValue) => setPref(prefName, inverted ? !newValue : newValue));
  listenForPrefChanges(prefName, (value) => setCheckboxValue(checkboxId, inverted ? !value : value));
};

const bindAllPrefsToCheckboxes = async () => {
  for (const [checkboxId, { prefName, inverted }] of Object.entries(PRIVACY_PREFS_CONFIG)) {
    await bindPrefToCheckbox(checkboxId, prefName, inverted);
  }
  listenForResetButtonClick(resetAllPrefsToDefaults);
};

document.addEventListener('DOMContentLoaded', async () => {
  initializePrefsUI();
  await bindAllPrefsToCheckboxes();
});