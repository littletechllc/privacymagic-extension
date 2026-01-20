import { SETTINGS_KEY_PREFIX, ALL_DOMAINS } from '../common/settings'
import { getLocalizedText } from '../common/i18n'
import { createToggle } from '../common/toggle'
import { logError, entries, handleAsync } from '../common/util'
import { SettingsId } from '../common/settings-ids'
import { updateSettingRemote, reloadTabRemote } from '../common/messages'
import { StorageProxy, KeyPath, storage } from '../common/storage'

type SettingsCategory =
  'main' |
  'blocking' |
  'fingerprinting' |
  'leakyFeatures' |
  'navigation' |
  'policy'

const PRIVACY_SETTINGS_CONFIG: Record<SettingsCategory, SettingsId[]> = {
  main: [
    'masterSwitch'
  ],
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
  keyPath: KeyPath,
  defaultValue: boolean
): Promise<void> => {
  const input = toggle.querySelector('input')
  if (input == null) {
    throw new Error('Input not found')
  }
  const storageValue = await store.get(keyPath)
  input.checked = storageValue !== undefined ? storageValue : defaultValue
  store.listenForChanges(keyPath, (value) => {
    input.checked = value !== undefined ? value : defaultValue
  })
}

const createToggleCategory = async (store: StorageProxy, domain: string, settingIds: SettingsId[], categoryId: SettingsCategory): Promise<HTMLElement> => {
  const category = document.createElement('div')
  category.id = categoryId
  category.className = 'toggle-box'
  const categoryTitle = document.createElement('h2')
  categoryTitle.textContent = getLocalizedText(categoryId)
  category.appendChild(categoryTitle)
  const sortedSettingIds = sortBy(settingIds, (settingId) => getLocalizedText(settingId))
  for (const settingId of sortedSettingIds) {
    const toggle = createToggle(settingId)
    const keyPath = [SETTINGS_KEY_PREFIX, domain, settingId]
    await bindToggleToStorage(toggle, store, keyPath, /* defaultValue */ true)
    category.appendChild(toggle)
  }
  return category
}

// Add a listener that reloads the tab when a per-site toggle is clicked.
const setupInputListeners = (domain: string): void => {
  document.querySelectorAll('#settings input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', (event) => {
      handleAsync(async () => {
        const target = event.target as HTMLInputElement
        const settingId = target.id as SettingsId
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
  })
}

export const setupSettingsUI = async (domain: string): Promise<void> => {
  const settingsContainer = document.getElementById('settings')
  if (settingsContainer == null) {
    throw new Error('Settings container not found')
  }
  settingsContainer.innerHTML = '<h1>Privacy Magic Protections</h1>'
  for (const [categoryId, settingIds] of entries(PRIVACY_SETTINGS_CONFIG)) {
    const toggleCategory = await createToggleCategory(storage.local, domain, settingIds, categoryId)
    settingsContainer.appendChild(toggleCategory)
  }
  if (domain !== ALL_DOMAINS) {
    setupInputListeners(domain)
  }
}
