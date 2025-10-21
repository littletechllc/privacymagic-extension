// Privacy prefs configuration
const PRIVACY_PREFS_CONFIG = {
  doNotTrackEnabled: {
    prefName: 'doNotTrackEnabled',
    inverted: false,
    locked: false,
    default: true
  },
  disableThirdPartyCookies: {
    prefName: 'thirdPartyCookiesAllowed',
    inverted: true,
    locked: false,
    default: false
  },
  disableReferrers: {
    prefName: 'referrersEnabled',
    inverted: true,
    locked: false,
    default: false
  },
  disableHyperlinkAuditing: {
    prefName: 'hyperlinkAuditingEnabled',
    inverted: true,
    locked: false,
    default: false
  },
  disableTopics: {
    prefName: 'topicsEnabled',
    inverted: true,
    locked: true,
    default: false
  },
  disableFledge: {
    prefName: 'fledgeEnabled',
    inverted: true,
    locked: true,
    default: false
  },
  disableAdMeasurement: {
    prefName: 'adMeasurementEnabled',
    inverted: true,
    locked: true,
    default: false
  },
  disableRelatedWebsiteSets: {
    prefName: 'relatedWebsiteSetsEnabled',
    inverted: true,
    locked: true,
    default: false
  }
};

const getPref = async (prefName) => {
  if (!chrome.privacy.websites[prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  const value = (await chrome.privacy.websites[prefName].get({})).value;
  console.log(`Read pref ${prefName} with value ${value}`);
  return value;
};

const setPref = async (prefName, value) => {
  if (!chrome.privacy.websites[prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  await chrome.privacy.websites[prefName].set({ value });
  console.log(`Set pref ${prefName} to value ${value}`);
  return true;
};

const listenForPrefChanges = (prefName, callback) => {
  if (!chrome.privacy.websites[prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  chrome.privacy.websites[prefName].onChange.addListener((details) => {
    console.log(`Pref ${prefName} changed to ${details.value}`);
    callback(details.value);
  });
};

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

const resetAllPrefsToDefaults = async () => {
  for (const config of Object.values(PRIVACY_PREFS_CONFIG)) {
    await setPref(config.prefName, config.default);
  }
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
  const prefsContainer = document.querySelector('.prefs');
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