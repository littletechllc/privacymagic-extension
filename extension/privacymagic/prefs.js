// Privacy prefs configuration
const PRIVACY_PREFS_CONFIG = {
  doNotTrackEnabled: {
    label: 'Enable Do Not Track',
    prefName: 'doNotTrackEnabled',
    inverted: false,
    locked: false,
    default: true
  },
  disableThirdPartyCookies: {
    label: 'Disable Third-Party Cookies',
    prefName: 'thirdPartyCookiesAllowed',
    inverted: true,
    locked: false,
    default: false
  },
  disableReferrers: {
    label: 'Disable Referrers',
    prefName: 'referrersEnabled',
    inverted: true,
    locked: false,
    default: false
  },
  disableHyperlinkAuditing: {
    label: 'Disable Hyperlink Auditing',
    prefName: 'hyperlinkAuditingEnabled',
    inverted: true,
    locked: false,
    default: false
  },
  disableTopics: {
    label: 'Disable Topics API (Always disabled)',
    prefName: 'topicsEnabled',
    inverted: true,
    locked: true,
    default: false
  },
  disableFledge: {
    label: 'Disable FLEDGE (Always disabled)',
    prefName: 'fledgeEnabled',
    inverted: true,
    locked: true,
    default: false
  },
  disableAdMeasurement: {
    label: 'Disable Ad Measurement (Always disabled)',
    prefName: 'adMeasurementEnabled',
    inverted: true,
    locked: true,
    default: false
  },
  disableRelatedWebsiteSets: {
    label: 'Disable Related Website Sets (Always disabled)',
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

const initializePrefsUI = () => {
  const prefsContainer = document.querySelector('.prefs');
  if (!prefsContainer) {
    throw new Error('Prefs container not found');
  }
  prefsContainer.innerHTML = Object.entries(PRIVACY_PREFS_CONFIG)
    .map(([checkboxId, { label, locked }]) => {
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