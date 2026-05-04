import { SettingId } from './setting-ids'
import { unique } from '@src/common/data-structures'

export const SETTINGS_KEY = '_SETTINGS_'

export type DisabledSettingCollection = Partial<Record<SettingId, string[]>>

const isDisabledSetting = (collection: DisabledSettingCollection, domain: string, settingId: SettingId): boolean => {
  return collection[settingId]?.includes(domain) ?? false
}

export const getDisabledSettingCollection = async (key: string): Promise<DisabledSettingCollection> => {
  return (await chrome.storage.local.get(key))[key] ?? {}
}

/** Add or remove a domain in a setting’s disabled-domain list (deduped). */
export const updateList = (list: string[], item: string, add: boolean): string[] => {
  const newList = add ? [...list, item] : list.filter(domain => domain !== item)
  return unique(newList)
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
    console.log('storage changed', changes, areaName)
    if (areaName !== 'local') {
      return
    }
    if (changes[SETTINGS_KEY] == null) {
      return
    }
    callback()
  })
}