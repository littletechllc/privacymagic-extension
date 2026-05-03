export const NETWORK_SETTING_IDS = [
  //'css',
  'cpu',
  'device',
  'display',
  'gpc',
  'language',
  'memory',
  'network',
  'queryParameters',
  'referrerPolicy',
  'screen',
  'useragent'
] as const

export const BLOCKER_SETTING_IDS = [
  'ads',
  'masterSwitch'
] as const

export const CONTENT_SETTING_IDS = [
  'audio',
  'battery',
  'cpu',
  //'css',
  'device',
  'disk',
  'display',
  'fonts',
  'gpc',
  'gpu',
  'iframe',
  'keyboard',
  'language',
  'masterSwitch',
  'math',
  'memory',
  'network',
  'screen',
  'serviceWorker',
  'sharedStorage',
  'timezone',
  'timer',
  'touch',
  'useragent',
  'windowName',
  'worker'
] as const


const unique = <T>(array: T[]): T[] => Array.from(new Set(array))

export const ALL_SETTING_IDS = unique([...NETWORK_SETTING_IDS, ...BLOCKER_SETTING_IDS, ...CONTENT_SETTING_IDS])

export type NetworkSettingId = typeof NETWORK_SETTING_IDS[number]
export type BlockerSettingId = typeof BLOCKER_SETTING_IDS[number]
export type ContentSettingId = typeof CONTENT_SETTING_IDS[number]
export type SettingId = NetworkSettingId | BlockerSettingId | ContentSettingId

export const isContentSetting = (setting: SettingId): setting is ContentSettingId => {
  return (CONTENT_SETTING_IDS as readonly string[]).includes(setting)
}

export const isBlockerSetting = (setting: SettingId): setting is BlockerSettingId => {
  return (BLOCKER_SETTING_IDS as readonly string[]).includes(setting)
}

export const isNetworkSetting = (setting: SettingId): setting is NetworkSettingId => {
  return (NETWORK_SETTING_IDS as readonly string[]).includes(setting)
}