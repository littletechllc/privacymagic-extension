import { logError } from './util'

type PrefCategory = keyof typeof chrome.privacy

// Privacy prefs configuration
interface PrefConfig {
  inverted: boolean
  locked: boolean
  category: PrefCategory
  onValue?: string
  offValue?: string
}

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
  'webRTCIPHandlingPolicy'

export const PRIVACY_PREFS_CONFIG: Record<PrefName, PrefConfig> = {
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
}

// Generate union type from the keys at compile time
export type PRIVACY_PREFS_NAME = keyof typeof PRIVACY_PREFS_CONFIG

const getPrivacyPref = (category: PrefCategory, prefName: PrefName): chrome.types.ChromeSetting<boolean | string> | undefined => {
  const categoryObj = chrome.privacy[category]
  if (categoryObj === null || categoryObj === undefined) {
    return undefined
  }
  return (categoryObj as Partial<Record<PrefName, chrome.types.ChromeSetting<boolean | string>>>)[prefName]
}

export const getPref = async (prefName: PRIVACY_PREFS_NAME): Promise<boolean> => {
  const config = PRIVACY_PREFS_CONFIG[prefName]
  const category = config.category
  const pref = getPrivacyPref(category, prefName)
  if (pref === null || pref === undefined) {
    throw new Error(`Pref ${prefName} not found`)
  }
  const result = await pref.get({})
  const value = result.value
  console.log(`Read pref ${prefName} with value ${String(value)}`)
  if (config.onValue !== undefined && config.onValue !== '') {
    // For prefs like webRTCIPHandlingPolicy, the value is a string that needs to be compared
    return String(value) === config.onValue
  }
  if (typeof value === 'boolean') {
    return value
  }
  throw new Error(`Pref ${prefName} returned unexpected type: ${typeof value}`)
}

export const setPref = async (prefName: PRIVACY_PREFS_NAME, value: boolean): Promise<void> => {
  const config = PRIVACY_PREFS_CONFIG[prefName]
  const category = config.category
  const pref = (chrome.privacy[category] as any)[prefName]
  if (pref === null || pref === undefined) {
    throw new Error(`Pref ${prefName} not found`)
  }
  let nativeValue: string | boolean = value
  if (config.onValue !== undefined && config.onValue !== '') {
    nativeValue = value ? config.onValue : (config.offValue ?? '')
  }
  await pref.set({ value: nativeValue })
  console.log(`Set pref ${prefName} to value ${String(nativeValue)}`)
}

export const listenForPrefChanges = (prefName: PRIVACY_PREFS_NAME, callback: (value: boolean) => void): void => {
  const config = PRIVACY_PREFS_CONFIG[prefName]
  const category = config.category
  const pref = (chrome.privacy[category] as any)[prefName]
  if (pref === null || pref === undefined) {
    throw new Error(`Pref ${prefName} not found`)
  }
  pref.onChange.addListener((details: { value: unknown }) => {
    try {
      console.log(`Pref ${prefName} changed to ${String(details.value)}`)
      let outValue: boolean = details.value as boolean
      if (config.onValue !== undefined && config.onValue !== '') {
        outValue = details.value === config.onValue
      }
      callback(outValue)
    } catch (error) {
      logError(error, 'error responding to pref change', { prefName, details })
    }
  })
}

export const resetAllPrefsToDefaults = async (): Promise<void> => {
  for (const [prefName, config] of Object.entries(PRIVACY_PREFS_CONFIG)) {
    await setPref(prefName as PRIVACY_PREFS_NAME, !config.inverted)
  }
}
