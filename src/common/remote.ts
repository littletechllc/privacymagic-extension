import { SettingId } from "./setting-ids"

const REMOTE_CONFIG_URL = "https://raw.githubusercontent.com/littletechllc/privacymagic-extension/refs/heads/main/remote/remote.json"
const REMOTE_CONFIG_CACHE_DURATION_MS = 1000 * 60 * 60 * 24

type RemoteConfig = {
  version: string
  setting_exceptions: Record<string, SettingId[]>
}

let latestRemoteConfig: RemoteConfig | undefined
let lastFetchTime: number | undefined

const fetchAndStoreRemoteConfig = async (): Promise<RemoteConfig> => {
  const response = await fetch(REMOTE_CONFIG_URL, { cache: 'no-store' })
  const data = await response.json() as RemoteConfig
  lastFetchTime = Date.now()
  return data
}

const getLatestRemoteConfig = async (): Promise<RemoteConfig> => {
  if (latestRemoteConfig !== undefined && lastFetchTime !== undefined &&
      Date.now() - lastFetchTime < REMOTE_CONFIG_CACHE_DURATION_MS) {
    return latestRemoteConfig
  }
  latestRemoteConfig = await fetchAndStoreRemoteConfig()
  return latestRemoteConfig
}

export const getSettingDisabledByRemoteConfig = async (domain: string, settingId: SettingId): Promise<boolean> => {
  const remoteConfig = await getLatestRemoteConfig()
  return remoteConfig.setting_exceptions[domain]?.includes(settingId)
}

export const getAllSettingsDisabledByRemoteConfig = async (): Promise<Record<string, SettingId[]>> => {
  const remoteConfig = await getLatestRemoteConfig()
  console.log('getAllSettingsDisabledByRemoteConfig', remoteConfig)
  return structuredClone(remoteConfig.setting_exceptions)
}