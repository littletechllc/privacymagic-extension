import { storage, KeyPath } from './storage'
import { SettingsId } from './settings-ids'

export const ALL_DOMAINS = '_ALL_DOMAINS_'
export const SETTINGS_KEY_PREFIX = '_SETTINGS_'

export const getSetting = async (domain: string, settingId: SettingsId): Promise<boolean> => {
  const defaultSetting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId])
  // If a setting has been set to false for the default settings,
  // then it overrides the domain-specific setting and we return
  // false regardless of the domain-specific value.
  if (defaultSetting === false) {
    return false
  }
  const domainSpecificSetting = await storage.local.get(
    [SETTINGS_KEY_PREFIX, domain, settingId]
  )
  // If a domain-specific setting has been set to false, then we
  // return false.
  if (domainSpecificSetting === false) {
    return false
  }
  // If a setting hasn't been set for either the default or
  // domain-specific settings, then we assume it's enabled.
  return true
}

export const setSetting = async (domain: string, settingId: SettingsId, value: boolean): Promise<void> => {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid setting value: ${String(value)}`)
  }
  // If the domain is the default domain, then we set the setting value.
  // We remove the setting if the value is being set to true, since
  // the default value is true.
  if (domain === ALL_DOMAINS) {
    if (value) {
      await storage.local.remove([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId])
    } else {
      await storage.local.set([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId], false)
    }
    return
  }
  // If the setting value is the same as the default value, then we remove the domain-specific setting.
  const defaultSetting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId])
  if (defaultSetting === value) {
    await storage.local.remove([SETTINGS_KEY_PREFIX, domain, settingId])
    return
  }
  // Otherwise, we set the domain-specific setting value.
  await storage.local.set([SETTINGS_KEY_PREFIX, domain, settingId], value)
}

export const getAllSettings = async (): Promise<Array<[string, SettingsId, boolean]>> => {
  const storedSettings = await storage.local.getAll()
  const allSettings: Array<[string, SettingsId, boolean]> = []
  for (const [[type, domain, settingId], value] of storedSettings as Array<[KeyPath, boolean]>) {
    if (type === SETTINGS_KEY_PREFIX) {
      allSettings.push([domain, settingId as SettingsId, value])
    }
  }
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
