import { SettingId } from "./setting-ids"

const REMOTE_CONFIG_URL = "https://raw.githubusercontent.com/littletechllc/privacymagic-extension/refs/heads/main/remote/remote.json"
const ALARM_NAME = "remote-config-refresh"
const CACHE_DURATION_MINUTES = 60 * 12

type RemoteConfig = {
  version: string
  setting_exceptions: Record<string, SettingId[]>
}

let latestRemoteConfig: RemoteConfig | undefined


const fetchAndStoreRemoteConfig = async (): Promise<void> => {
  const response = await fetch(REMOTE_CONFIG_URL, { cache: 'no-store' })
  latestRemoteConfig = await response.json() as RemoteConfig
  await chrome.storage.local.set({ remoteConfig: latestRemoteConfig })
}

const initializeRemoteConfig = async (): Promise<void> => {
  if (latestRemoteConfig == null) {
    const { remoteConfig } = await chrome.storage.local.get({ remoteConfig: undefined })
    latestRemoteConfig = remoteConfig as RemoteConfig
    if (latestRemoteConfig == null) {
      void fetchAndStoreRemoteConfig()
    }
  }
}

const ensureAlarmExists = async (): Promise<void> => {
  const alarm = await chrome.alarms.get(ALARM_NAME)
  if (alarm == null) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: CACHE_DURATION_MINUTES })
  }
}

const onAlarm = (alarm: chrome.alarms.Alarm): void => {
  if (alarm.name === ALARM_NAME) {
    void fetchAndStoreRemoteConfig()
  }
}

export const startWatchingRemoteConfig = (): void => {
  chrome.alarms.onAlarm.addListener(onAlarm)
  void ensureAlarmExists()
  void initializeRemoteConfig()
}

export const getSettingDisabledByRemoteConfig = (domain: string, settingId: SettingId): boolean => {
  return latestRemoteConfig?.setting_exceptions[domain]?.includes(settingId) ?? false
}

export const getAllSettingsDisabledByRemoteConfig = (): Record<string, SettingId[]> => {
  return structuredClone(latestRemoteConfig?.setting_exceptions ?? {})
}