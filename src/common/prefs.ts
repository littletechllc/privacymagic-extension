import { logError } from './util.js';

// Privacy prefs configuration
export const PRIVACY_PREFS_CONFIG :
  Record<string, {
    inverted: boolean;
    locked: boolean;
    category: string;
    onValue?: string;
    offValue?: string;
  }> = {
  thirdPartyCookiesAllowed: {
    inverted: true,
    locked: false,
    category: 'websites'
  },
  hyperlinkAuditingEnabled: {
    inverted: true,
    locked: false,
    category: 'websites'
  },
  webRTCIPHandlingPolicy: {
    inverted: true,
    locked: false,
    category: 'network',
    onValue: 'default',
    offValue: 'disable_non_proxied_udp'
  },
  alternateErrorPagesEnabled: {
    inverted: true,
    locked: false,
    category: 'services'
  },
  safeBrowsingExtendedReportingEnabled: {
    inverted: true,
    locked: false,
    category: 'services'
  },
  spellingServiceEnabled: {
    inverted: true,
    locked: false,
    category: 'services'
  },
  searchSuggestEnabled: {
    inverted: true,
    locked: false,
    category: 'services'
  },
  topicsEnabled: {
    inverted: true,
    locked: true,
    category: 'websites'
  },
  fledgeEnabled: {
    inverted: true,
    locked: true,
    category: 'websites'
  },
  adMeasurementEnabled: {
    inverted: true,
    locked: true,
    category: 'websites'
  },
  relatedWebsiteSetsEnabled: {
    inverted: true,
    locked: true,
    category: 'websites'
  }
};

export const getPref = async (prefName) => {
  if (!chrome.privacy[PRIVACY_PREFS_CONFIG[prefName].category][prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  if (!PRIVACY_PREFS_CONFIG[prefName]) {
    throw new Error(`Pref ${prefName} not found in config`);
  }
  const value = (await chrome.privacy[PRIVACY_PREFS_CONFIG[prefName].category][prefName].get({})).value;
  console.log(`Read pref ${prefName} with value ${value}`);
  if (PRIVACY_PREFS_CONFIG[prefName].onValue) {
    return value === PRIVACY_PREFS_CONFIG[prefName].onValue;
  }
  return value;
};

export const setPref = async (prefName, value) => {
  if (!chrome.privacy[PRIVACY_PREFS_CONFIG[prefName].category][prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  if (!PRIVACY_PREFS_CONFIG[prefName]) {
    throw new Error(`Pref ${prefName} not found in config`);
  }
  let nativeValue = value;
  if (PRIVACY_PREFS_CONFIG[prefName].onValue) {
    nativeValue = value ? PRIVACY_PREFS_CONFIG[prefName].onValue : PRIVACY_PREFS_CONFIG[prefName].offValue;
  }
  await chrome.privacy[PRIVACY_PREFS_CONFIG[prefName].category][prefName].set({ value: nativeValue });
  console.log(`Set pref ${prefName} to value ${nativeValue}`);
  return true;
};

export const listenForPrefChanges = (prefName, callback) => {
  if (!chrome.privacy[PRIVACY_PREFS_CONFIG[prefName].category][prefName]) {
    throw new Error(`Pref ${prefName} not found`);
  }
  if (!PRIVACY_PREFS_CONFIG[prefName]) {
    throw new Error(`Pref ${prefName} not found in config`);
  }
  chrome.privacy[PRIVACY_PREFS_CONFIG[prefName].category][prefName].onChange.addListener((details) => {
    try {
      console.log(`Pref ${prefName} changed to ${details.value}`);
      let outValue = details.value;
      if (PRIVACY_PREFS_CONFIG[prefName].onValue) {
        outValue = details.value === PRIVACY_PREFS_CONFIG[prefName].onValue;
      }
      callback(outValue);
    } catch (error) {
      logError(error, 'error responding to pref change', { prefName, details });
    }
  });
};

export const resetAllPrefsToDefaults = async () => {
  for (const [prefName, config] of Object.entries(PRIVACY_PREFS_CONFIG)) {
    await setPref(prefName, !config.inverted);
  }
};
