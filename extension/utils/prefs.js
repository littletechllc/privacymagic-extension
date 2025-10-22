// Privacy prefs configuration
export const PRIVACY_PREFS_CONFIG = {
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

export const getPref = async (prefName) => {
  if (!chrome.privacy.websites[prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  const value = (await chrome.privacy.websites[prefName].get({})).value;
  console.log(`Read pref ${prefName} with value ${value}`);
  return value;
};

export const setPref = async (prefName, value) => {
  if (!chrome.privacy.websites[prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  await chrome.privacy.websites[prefName].set({ value });
  console.log(`Set pref ${prefName} to value ${value}`);
  return true;
};

export const listenForPrefChanges = (prefName, callback) => {
  if (!chrome.privacy.websites[prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  chrome.privacy.websites[prefName].onChange.addListener((details) => {
    console.log(`Pref ${prefName} changed to ${details.value}`);
    callback(details.value);
  });
};

export const resetAllPrefsToDefaults = async () => {
  for (const config of Object.values(PRIVACY_PREFS_CONFIG)) {
    await setPref(config.prefName, config.default);
  }
};