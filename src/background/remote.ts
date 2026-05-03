import { SettingId } from '@src/common/setting-ids'
import { handleAsync, logError } from '@src/common/util'
import { updateRemoteConfig } from './settings-write'

const REMOTE_CONFIG_URL = "https://raw.githubusercontent.com/littletechllc/privacymagic-extension/refs/heads/main/remote/remote.json"
const ALARM_NAME = "remote-config-refresh"
const CACHE_DURATION_MINUTES = 60 * 12 // 12 hours
const REMOTE_CONFIG_TIMESTAMP_KEY = 'remoteConfigTimestamp'

type RemoteConfig = {
  version: string
  setting_exceptions: Record<string, SettingId[]>
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
  await updateRemoteConfig(remoteConfig.setting_exceptions)
  await chrome.storage.local.set({ [REMOTE_CONFIG_TIMESTAMP_KEY]: Date.now() })
}

const initializeRemoteConfig = async (): Promise<void> => {
  const storedTimestamp = (await chrome.storage.local.get(REMOTE_CONFIG_TIMESTAMP_KEY))[REMOTE_CONFIG_TIMESTAMP_KEY]
  const remoteConfigTimestamp = typeof storedTimestamp === 'number' ? storedTimestamp : 0
  if (remoteConfigTimestamp === 0 || remoteConfigTimestamp < Date.now() - CACHE_DURATION_MINUTES * 60 * 1000) {
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
  chrome.alarms.onAlarm.removeListener(onAlarm)
  chrome.alarms.onAlarm.addListener(onAlarm)
  handleAsync(async () => {
    await ensureAlarmExists()
    await initializeRemoteConfig()
  }, (error) => {
    logError(error, 'error initializing remote config')
  })
}
