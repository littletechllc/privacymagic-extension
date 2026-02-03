import { SETTINGS_KEY_PREFIX } from '@src/common/settings'
import { getLocalizedText } from '@src/common/i18n'
import { createToggle } from '@src/common/toggle'
import { logError, handleAsync } from '@src/common/util'
import { objectEntries } from '@src/common/data-structures'
import { SettingId } from '@src/common/setting-ids'
import { updateSettingRemote, reloadTabRemote } from '@src/common/messages'
import { StorageProxy, storage } from '@src/common/storage'

type SettingsCategory =
  'masterSwitch' |
  'blocking' |
  'fingerprinting' |
  'leakyFeatures' |
  'navigation' |
  'policy'

const PRIVACY_SETTINGS_CONFIG: Record<Exclude<SettingsCategory, 'masterSwitch'>, SettingId[]> = {
  blocking: [
    'ads'
  ],
  fingerprinting: [
    // 'audio',
    'battery',
    'cpu',
    'device',
    'disk',
    'display',
    // 'fonts',
    'gpu',
    'keyboard',
    'language',
    'math',
    'memory',
    'network',
    'screen',
    'timezone',
    'timer',
    'touch',
    'useragent'
  ],
  navigation: [
    'queryParameters',
    'referrerPolicy',
    'windowName'
  ],
  leakyFeatures: [
    'css',
    'iframe',
    'serviceWorker',
    'sharedStorage',
    'worker'
  ],
  policy: [
    'gpc'
  ]
}

const sortBy = <T>(array: T[], keyFn: (item: T) => string): T[] => {
  return array.sort((a, b) => {
    const aKey = keyFn(a)
    const bKey = keyFn(b)
    return aKey.localeCompare(bKey)
  })
}

const bindToggleToStorage = async (
  toggle: HTMLElement,
  store: StorageProxy,
  domain: string,
  settingId: SettingId,
  defaultValue: boolean
): Promise<void> => {
  const input = toggle.querySelector('input')
  if (input == null) {
    throw new Error('Input not found')
  }
  const keyPath = [SETTINGS_KEY_PREFIX, domain, settingId]
  const storageValue = await store.get(keyPath)
  input.checked = storageValue !== undefined ? storageValue : defaultValue
  store.listenForChanges(keyPath, (value) => {
    input.checked = value !== undefined ? value : defaultValue
  })
  input.addEventListener('change', (event) => {
    handleAsync(async () => {
      const target = event.target as HTMLInputElement
      const settingId = target.id as SettingId
      const response = await updateSettingRemote(domain, settingId, target.checked)
      console.log('sendMessage response:', response)
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tabId = tabs[0].id
      if (tabId == null) {
        throw new Error('No active tab found')
      }
      await reloadTabRemote(tabId)
    }, (error) => {
      logError(error, 'error updating setting', { event: JSON.stringify(event) })
    })
  })
}

export const createToggleWithBinding = async (store: StorageProxy, domain: string, settingId: SettingId): Promise<HTMLElement> => {
  const toggle = createToggle(settingId)
  await bindToggleToStorage(toggle, store, domain, settingId, /* defaultValue */ true)
  return toggle
}

const createToggleCategory = async (store: StorageProxy, domain: string, settingIds: SettingId[], categoryId: SettingsCategory): Promise<HTMLElement> => {
  const category = document.createElement('div')
  category.id = categoryId
  category.className = 'toggle-box'
  const categoryTitle = document.createElement('h2')
  categoryTitle.textContent = getLocalizedText(categoryId)
  category.appendChild(categoryTitle)
  const sortedSettingIds = sortBy(settingIds, (settingId) => getLocalizedText(settingId))
  for (const settingId of sortedSettingIds) {
    const toggle = await createToggleWithBinding(store, domain, settingId)
    category.appendChild(toggle)
  }
  return category
}

export const setupSettingsUI = async (domain: string): Promise<void> => {
  const settingsContainer = document.getElementById('settings')
  if (settingsContainer == null) {
    throw new Error('Settings container not found')
  }
  settingsContainer.innerHTML = '<h1>Privacy Magic Protections</h1>'
  for (const [categoryId, settingIds] of objectEntries(PRIVACY_SETTINGS_CONFIG)) {
    const toggleCategory = await createToggleCategory(storage.local, domain, settingIds, categoryId)
    settingsContainer.appendChild(toggleCategory)
  }
}
