import { ALL_SETTING_IDS, SettingId } from '@src/common/setting-ids'
import { unique } from '@src/common/data-structures'
import {
  SETTINGS_KEY,
  type DisabledSettingCollection,
  getDisabledSettingCollection,
  updateList
} from '@src/common/settings-read'
import { updateRulesForAllSettings, updateRulesForSetting } from './dnr/rule-manager'

const REMOTE_SETTINGS_KEY = '_REMOTE_SETTINGS_'
const SETTINGS_LOCK_NAME = '_SETTINGS_LOCK_'

const withSettingsLock = async <T>(callback: () => Promise<T>): Promise<T> => {
  return await navigator.locks.request(SETTINGS_LOCK_NAME, callback)
}

export const setUserDisabledSetting = async (domain: string, settingId: SettingId, disabled: boolean): Promise<void> => {
  await withSettingsLock(async () => {
    const allUserDisabledSettings: DisabledSettingCollection = await getDisabledSettingCollection(SETTINGS_KEY)
    allUserDisabledSettings[settingId] = updateList(allUserDisabledSettings[settingId] ?? [], domain, disabled)
    await chrome.storage.local.set({ [SETTINGS_KEY]: allUserDisabledSettings })
    await updateRulesForSetting(settingId, allUserDisabledSettings[settingId])
  })
}

/**
 * Update the remote config in storage. If the remote config has been updated, the user settings are
 * updated to reflect the new remote config. Specifically, if a setting is disabled by the remote config,
 * it is added to the user settings. If a setting is enabled by the remote config, it is removed from the
 * user setting. That's because the remote setting changes can override the user settings.
 * @param newRemoteConfig - The new remote config to update storage with.
 */
export const updateRemoteConfig = async (newRemoteConfig: DisabledSettingCollection): Promise<void> => {
  await withSettingsLock(async () => {
    const oldRemoteConfig: DisabledSettingCollection = await getDisabledSettingCollection(REMOTE_SETTINGS_KEY)
    const userDisabledSettings: DisabledSettingCollection = await getDisabledSettingCollection(SETTINGS_KEY)
    for (const settingId of ALL_SETTING_IDS) {
      const oldDomainsWhereSettingIsDisabled = oldRemoteConfig[settingId] ?? []
      const newDomainsWhereSettingIsDisabled = newRemoteConfig[settingId] ?? []
      const addedDomainsWhereSettingIsDisabled = newDomainsWhereSettingIsDisabled.filter(domain => !oldDomainsWhereSettingIsDisabled.includes(domain))
      const removedDomainsWhereSettingIsDisabled = oldDomainsWhereSettingIsDisabled.filter(domain => !newDomainsWhereSettingIsDisabled.includes(domain))
      if (addedDomainsWhereSettingIsDisabled.length > 0) {
        userDisabledSettings[settingId] = unique(
          [...(userDisabledSettings[settingId] ?? []),
          ...addedDomainsWhereSettingIsDisabled])
      }
      if (removedDomainsWhereSettingIsDisabled.length > 0) {
        userDisabledSettings[settingId] = (userDisabledSettings[settingId] ?? [])
          .filter(domain => !removedDomainsWhereSettingIsDisabled.includes(domain))
      }
    }
    await chrome.storage.local.set({ [SETTINGS_KEY]: userDisabledSettings })
    await chrome.storage.local.set({ [REMOTE_SETTINGS_KEY]: newRemoteConfig })
    await updateRulesForAllSettings(userDisabledSettings)
  })
}

export const resetAllSettingsToRemote = async (): Promise<void> => {
  await withSettingsLock(async () => {
    const remoteConfig = await getDisabledSettingCollection(REMOTE_SETTINGS_KEY)
    await chrome.storage.local.set({ [SETTINGS_KEY]: remoteConfig })
    await updateRulesForAllSettings(remoteConfig)
  })
}
