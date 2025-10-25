import { PRIVACY_PREFS_CONFIG, getPref, setPref, listenForPrefChanges, resetAllPrefsToDefaults } from '../common/prefs.js';
import { getLocalizedText } from '../common/i18n.js';

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

const createPrefsUI = () => {
  const prefsContainer = document.getElementById('prefs');
  if (!prefsContainer) {
    throw new Error('Prefs container not found');
  }
  prefsContainer.innerHTML = `<h1>Browser Preferences</h1>` + Object.entries(PRIVACY_PREFS_CONFIG)
    .map(([checkboxId, { locked }]) => {
      const label = (locked ? '🔒 ' : '') + getLocalizedText(checkboxId);
      return `<div class="toggle-outer">
        <input type="checkbox" id="${checkboxId}" ${locked ? 'disabled' : ''}/>
        <label for="${checkboxId}" class="box ${locked ? 'locked' : ''}">
          <div class="switch" ></div>
        </label>
        </label>
        <label for="${checkboxId}" class="text ${locked ? 'locked' : ''}">${label}</label>
      </div>
`
    })
    .join('\n');
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
};

export const setupPrefsUI = async () => {
  createPrefsUI();
  await bindAllPrefsToCheckboxes();
};
