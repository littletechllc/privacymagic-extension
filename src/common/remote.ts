import { SettingId } from "./setting-ids"
import { handleAsync, logError } from "./util"

const REMOTE_CONFIG_URL = "https://raw.githubusercontent.com/littletechllc/privacymagic-extension/refs/heads/main/remote/remote.json"
const ALARM_NAME = "remote-config-refresh"
const CACHE_DURATION_MINUTES = 60 * 12 // 12 hours

type RemoteConfig = {
  version: string
  setting_exceptions: Record<string, SettingId[]>
}

const getStoredRemoteConfig = async (): Promise<{ remoteConfig?: RemoteConfig, remoteConfigTimestamp?: number }> => {
  const { remoteConfig, remoteConfigTimestamp } : { remoteConfig?: RemoteConfig, remoteConfigTimestamp?: number } = await chrome.storage.local.get(['remoteConfig', 'remoteConfigTimestamp'])
  return { remoteConfig, remoteConfigTimestamp }
}

const storeRemoteConfig = async (remoteConfig: RemoteConfig): Promise<void> => {
  await chrome.storage.local.set({ remoteConfig: remoteConfig, remoteConfigTimestamp: Date.now() })
}

const fetchAndStoreRemoteConfig = async (): Promise<void> => {
  const response = await fetch(REMOTE_CONFIG_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to fetch remote config: ${response.statusText}`)
  }
  const remoteConfig = await response.json() as RemoteConfig
  if (remoteConfig == null ||
      remoteConfig.version == null ||
      remoteConfig.setting_exceptions == null ||
      typeof remoteConfig.version !== 'string' ||
      typeof remoteConfig.setting_exceptions !== 'object') {
    throw new Error('Invalid remote config')
  }
  await storeRemoteConfig(remoteConfig)
}

const initializeRemoteConfig = async (): Promise<void> => {
  const {remoteConfig, remoteConfigTimestamp} : { remoteConfig?: RemoteConfig, remoteConfigTimestamp?: number } = await getStoredRemoteConfig()
  if (remoteConfig == null || remoteConfigTimestamp == null || remoteConfigTimestamp < Date.now() - CACHE_DURATION_MINUTES * 60 * 1000) {
    await fetchAndStoreRemoteConfig()
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
    handleAsync(async () => {
      await fetchAndStoreRemoteConfig()
    }, (error) => {
      logError(error, 'error fetching and storing remote config')
    })
  }
}

export const startWatchingRemoteConfig = (): void => {
  chrome.alarms.onAlarm.addListener(onAlarm)
  handleAsync(async () => {
    await ensureAlarmExists()
    await initializeRemoteConfig()
  }, (error) => {
    logError(error, 'error initializing remote config')
  })
}

export const getSettingDisabledByRemoteConfig = async (domain: string, settingId: SettingId): Promise<boolean> => {
  const { remoteConfig } : { remoteConfig?: RemoteConfig } = await getStoredRemoteConfig()
  return remoteConfig?.setting_exceptions[domain]?.includes(settingId) ?? false
}

export const getAllSettingsDisabledByRemoteConfig = async (): Promise<Record<string, SettingId[]>> => {
  const { remoteConfig } : { remoteConfig?: RemoteConfig } = await getStoredRemoteConfig()
  return structuredClone(remoteConfig?.setting_exceptions ?? {})
}

export const addRemoteConfigListener = (listener: () => void): void => {
  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.remoteConfig) {
      listener()
    }
  })
}