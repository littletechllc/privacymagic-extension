import { SettingId } from './setting-ids'

export const SETTINGS_KEY = '_SETTINGS_'

export type DisabledSettingCollection = Partial<Record<SettingId, string[]>>

const storageGet = async <T>(key: keyof T): Promise<T> => {
  return (await chrome.storage.session.get(key))
}

const isDisabledSetting = (collection: DisabledSettingCollection, domain: string, settingId: SettingId): boolean => {
  return collection[settingId]?.includes(domain) ?? false
}

export const getDisabledSettingCollection = async (key: string): Promise<DisabledSettingCollection> => {
  return (await storageGet(key))[key] ?? {}
}

export const getDisabledSettings = async (): Promise<DisabledSettingCollection> => {
  return await getDisabledSettingCollection(SETTINGS_KEY)
}

export const getSettingDisabled = async (domain: string, settingId: SettingId): Promise<boolean> => {
  const allUserDisabledSettings: DisabledSettingCollection = await getDisabledSettingCollection(SETTINGS_KEY)
  return isDisabledSetting(allUserDisabledSettings, domain, settingId)
}

export const getDomainsWhereSettingIsDisabled = async (settingId: SettingId): Promise<string[]> => {
  const allUserDisabledSettings: DisabledSettingCollection = await getDisabledSettingCollection(SETTINGS_KEY)
  return allUserDisabledSettings[settingId] ?? []
}

export const listenForSettingsChanges = (callback: () => void): void => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'session' || changes[SETTINGS_KEY] == null) {
      return
    }
    callback()
  })
}