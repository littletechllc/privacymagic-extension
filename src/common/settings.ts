import { storage, KeyPath } from './storage'
import { SettingId } from './setting-ids'
import { getAllSettingsDisabledByRemoteConfig, getSettingDisabledByRemoteConfig } from './remote'

export const ALL_DOMAINS = '_ALL_DOMAINS_'
export const SETTINGS_KEY_PREFIX = '_SETTINGS_'

export const getSetting = async (domain: string, settingId: SettingId): Promise<boolean> => {
  const globalSetting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId])
  // If a setting has been set to false for the global settings,
  // then it overrides the domain-specific setting and we return
  // false regardless of the domain-specific value.
  if (globalSetting === false) {
    return false
  }
  const domainSpecificSetting = await storage.local.get(
    [SETTINGS_KEY_PREFIX, domain, settingId]
  )
  if (domainSpecificSetting === undefined) {
    const disabledByRemoteConfig = await getSettingDisabledByRemoteConfig(domain, settingId)
    if (disabledByRemoteConfig) {
      return false
    }
    // If a setting hasn't been set for either the default or
    // domain-specific settings, then we assume it's enabled.
    return true
  }
  // If a setting has been set for the domain-specific settings,
  // then we return it.
  console.log('getSetting', domain, settingId, domainSpecificSetting)
  return domainSpecificSetting
}

export const setSetting = async (domain: string, settingId: SettingId, value: boolean): Promise<void> => {
  console.log('setSetting', domain, settingId, value)
  // If the domain is the global domain, then we set the setting value.
  // We remove the setting if the value is being set to true, since
  // the default value is true.
  if (domain === ALL_DOMAINS) {
    if (value === true) {
      await storage.local.remove([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId])
    } else {
      await storage.local.set([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId], false)
    }
    return
  }
  // If the setting status is the same as the remote status, then we remove the domain-specific setting.
  const disabledByRemoteConfig = await getSettingDisabledByRemoteConfig(domain, settingId)
  if ((value === false && disabledByRemoteConfig) || (value === true && !disabledByRemoteConfig)) {
    await storage.local.remove([SETTINGS_KEY_PREFIX, domain, settingId])
    return
  }
  // Otherwise, we set the domain-specific setting value.
  await storage.local.set([SETTINGS_KEY_PREFIX, domain, settingId], value)
}

export const getAllSettings = async (): Promise<Array<[string, SettingId, boolean]>> => {
  const storedSettings = await storage.local.getAll()
  const allSettings: Array<[string, SettingId, boolean]> = []
  const alreadySeenSettings : Set<string> = new Set()
  for (const [[type, domain, settingId], value] of storedSettings as Array<[KeyPath, boolean]>) {
    if (type === SETTINGS_KEY_PREFIX) {
      allSettings.push([domain, settingId as SettingId, value])
      alreadySeenSettings.add(`${domain}:${settingId}`)
    }
  }
  const allSettingsDisabledByRemoteConfig = await getAllSettingsDisabledByRemoteConfig()
  for (const [domain, settingIds] of Object.entries(allSettingsDisabledByRemoteConfig)) {
    for (const settingId of settingIds) {
        if (!alreadySeenSettings.has(`${domain}:${settingId}`)) {
          allSettings.push([domain, settingId, false])
          alreadySeenSettings.add(`${domain}:${settingId}`)
        }
    }
  }
  console.log('getAllSettings', allSettings)
  return allSettings
}

export const resetAllSettingsToDefaults = async (domain: string): Promise<void> => {
  const items = await storage.local.getAll()
  for (const [keyPath] of items) {
    if (keyPath[0] === '_SETTINGS_' && keyPath[1] === domain) {
      await storage.local.remove(keyPath)
    }
  }
}
