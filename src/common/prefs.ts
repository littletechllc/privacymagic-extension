import { logError } from './util';

type PrefCategory = 'websites' | 'services' | 'network';

// Privacy prefs configuration
type PrefConfig = {
  inverted: boolean;
  locked: boolean;
  category: PrefCategory;
  onValue?: string;
  offValue?: string;
};

export type PrefName =
  'adMeasurementEnabled' |
  'alternateErrorPagesEnabled' |
  'fledgeEnabled' |
  'hyperlinkAuditingEnabled' |
  'relatedWebsiteSetsEnabled' |
  'safeBrowsingExtendedReportingEnabled' |
  'searchSuggestEnabled' |
  'spellingServiceEnabled' |
  'thirdPartyCookiesAllowed' |
  'topicsEnabled' |
  'webRTCIPHandlingPolicy';

export const PRIVACY_PREFS_CONFIG : Record<PrefName, PrefConfig> = {
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

// Generate union type from the keys at compile time
export type PRIVACY_PREFS_NAME = keyof typeof PRIVACY_PREFS_CONFIG;

export const getPref = async (prefName: PRIVACY_PREFS_NAME) => {
  const config = PRIVACY_PREFS_CONFIG[prefName];
  const category = config.category as keyof typeof chrome.privacy;
  const pref = (chrome.privacy[category] as any)[prefName];
  if (!pref) {
    throw new Error(`Pref ${prefName} not found`);
  }
  const value = (await pref.get({})).value;
  console.log(`Read pref ${prefName} with value ${value}`);
  if (config.onValue) {
    return value === config.onValue;
  }
  return value;
};

export const setPref = async (prefName: PRIVACY_PREFS_NAME, value: boolean) => {
  const config = PRIVACY_PREFS_CONFIG[prefName];
  const category = config.category as keyof typeof chrome.privacy;
  const pref = (chrome.privacy[category] as any)[prefName];
  if (!pref) {
    throw new Error(`Pref ${prefName} not found`);
  }
  let nativeValue: string | boolean = value;
  if (config.onValue) {
    nativeValue = value ? config.onValue : (config.offValue ?? '');
  }
  await pref.set({ value: nativeValue });
  console.log(`Set pref ${prefName} to value ${nativeValue}`);
  return true;
};

export const listenForPrefChanges = (prefName: PRIVACY_PREFS_NAME, callback: (value: boolean) => void) => {
  const config = PRIVACY_PREFS_CONFIG[prefName];
  const category = config.category as keyof typeof chrome.privacy;
  const pref = (chrome.privacy[category] as any)[prefName];
  if (!pref) {
    throw new Error(`Pref ${prefName} not found`);
  }
  pref.onChange.addListener((details: { value: unknown }) => {
    try {
      console.log(`Pref ${prefName} changed to ${details.value}`);
      let outValue: boolean = details.value as boolean;
      if (config.onValue) {
        outValue = details.value === config.onValue;
      }
      callback(outValue);
    } catch (error) {
      logError(error, 'error responding to pref change', { prefName, details });
    }
  });
};

export const resetAllPrefsToDefaults = async () => {
  for (const [prefName, config] of Object.entries(PRIVACY_PREFS_CONFIG)) {
    await setPref(prefName as PRIVACY_PREFS_NAME, !config.inverted);
  }
};
