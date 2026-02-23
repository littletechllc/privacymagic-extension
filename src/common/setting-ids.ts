export const NETWORK_SETTING_IDS = [
  //'css',
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

export type NetworkSettingId = typeof NETWORK_SETTING_IDS[number]
export type BlockerSettingId = typeof BLOCKER_SETTING_IDS[number]
export type ContentSettingId = typeof CONTENT_SETTING_IDS[number]
export type SettingId = NetworkSettingId | BlockerSettingId | ContentSettingId
