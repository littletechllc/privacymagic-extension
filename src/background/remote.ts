import { ALL_SETTING_IDS, SettingId } from '@src/common/setting-ids'
import { handleAsync, logError } from '@src/common/util'
import { updateRemoteConfig } from './settings-write'
import { get as getRegistrableDomain } from 'psl'

const REMOTE_CONFIG_URL = "https://raw.githubusercontent.com/littletechllc/privacymagic-extension/refs/heads/main/remote/remote.json"
const ALARM_NAME = "remote-config-refresh"
const CACHE_DURATION_MINUTES = 60 * 12 // 12 hours
const REMOTE_CONFIG_TIMESTAMP_KEY = 'remoteConfigTimestamp'

const ALLOWED_REMOTE_CONFIG_KEYS = new Set(['version', 'setting_exceptions', '$schema'])

export type RemoteConfig = {
  $schema?: string
  version: number
  setting_exceptions: Partial<Record<SettingId, string[]>>
}

export const isValidRemoteConfig = (receivedRemoteConfig: RemoteConfig): boolean => {
  if (receivedRemoteConfig == null ||
      receivedRemoteConfig.version == null ||
      receivedRemoteConfig.setting_exceptions == null ||
      typeof receivedRemoteConfig.version !== 'number' ||
      !Number.isInteger(receivedRemoteConfig.version) ||
      receivedRemoteConfig.version < 1 ||
      typeof receivedRemoteConfig.setting_exceptions !== 'object' ||
      Array.isArray(receivedRemoteConfig.setting_exceptions)) {
    return false
  }
  for (const key of Object.keys(receivedRemoteConfig)) {
    if (!ALLOWED_REMOTE_CONFIG_KEYS.has(key)) {
      return false
    }
  }
  for (const [settingId, domains] of Object.entries(receivedRemoteConfig.setting_exceptions)) {
    if (!ALL_SETTING_IDS.includes(settingId as SettingId)) {
      return false
    }
    if (domains == null || !Array.isArray(domains) || domains.length === 0) {
      return false
    }
    for (const domain of domains) {
      if (typeof domain !== 'string' || getRegistrableDomain(domain) !== domain) {
        return false
      }
    }
  }
  return true
}

const fetchAndStoreRemoteConfig = async (): Promise<void> => {
  const response = await fetch(REMOTE_CONFIG_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to fetch remote config: ${response.statusText}`)
  }
  const remoteConfig = await response.json() as RemoteConfig
  if (!isValidRemoteConfig(remoteConfig)) {
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
