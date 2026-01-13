import { logError } from './util'

type PrefCategory = keyof typeof chrome.privacy

// Union of all pref keys across all categories (websites, network, services, etc.)
export type BrowserPrivacyPrefName = {
  [K in PrefCategory]: keyof typeof chrome.privacy[K]
}[PrefCategory]

// Privacy prefs configuration
interface PrefConfig {
  inverted: boolean
  locked: boolean
  category: PrefCategory
  onValue?: string
  offValue?: string
}

export const PRIVACY_PREFS_CONFIG = {
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
} satisfies { [K in BrowserPrivacyPrefName]?: PrefConfig }

export type PrefName = keyof typeof PRIVACY_PREFS_CONFIG

const PREF_NAMES = Object.keys(PRIVACY_PREFS_CONFIG) as PrefName[]

const getPrivacyPrefObject = (prefName: PrefName): chrome.types.ChromeSetting<boolean | string> => {
  const category = PRIVACY_PREFS_CONFIG[prefName].category
  const categoryObj = chrome.privacy[category]
  return categoryObj[prefName as keyof typeof categoryObj]
}

export const getPref = async (prefName: PrefName): Promise<boolean> => {
  const config = PRIVACY_PREFS_CONFIG[prefName] as PrefConfig
  const prefObject = getPrivacyPrefObject(prefName)
  const result = await prefObject.get({})
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

export const setPref = async (prefName: PrefName, value: boolean): Promise<void> => {
  const config = PRIVACY_PREFS_CONFIG[prefName] as PrefConfig
  const pref = getPrivacyPrefObject(prefName)
  let nativeValue: string | boolean = value
  if (config.onValue !== undefined && config.onValue !== '') {
    nativeValue = value ? config.onValue : (config.offValue ?? '')
  }
  await pref.set({ value: nativeValue })
  console.log(`Set pref ${prefName} to value ${String(nativeValue)}`)
}

export const listenForPrefChanges = (prefName: PrefName, callback: (value: boolean) => void): void => {
  const config = PRIVACY_PREFS_CONFIG[prefName] as PrefConfig
  const pref = getPrivacyPrefObject(prefName)
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
  for (const prefName of PREF_NAMES) {
    await setPref(prefName, !PRIVACY_PREFS_CONFIG[prefName].inverted)
  }
}
