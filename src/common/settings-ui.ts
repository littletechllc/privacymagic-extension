import { SETTINGS_KEY_PREFIX, getSetting } from '@src/common/settings'
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
    //'css',
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
  _defaultValue: boolean
): Promise<void> => {
  const input = toggle.querySelector('input')
  if (input == null) {
    throw new Error('Input not found')
  }
  const keyPath = [SETTINGS_KEY_PREFIX, domain, settingId]
  // Use effective setting (getSetting) so remote-disabled shows as off; raw storage has no key when remote disables.
  const effectiveValue = await getSetting(domain, settingId)
  input.checked = effectiveValue
  store.listenForChanges(keyPath, (value) => {
    if (value !== undefined) {
      input.checked = value
    } else {
      void getSetting(domain, settingId).then((v) => { input.checked = v })
    }
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
  await bindToggleToStorage(toggle, store, domain, settingId, true)
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

export const createMasterSwitch = async (domain: string): Promise<HTMLElement> => {
  const masterSwitchToggle = await createToggleWithBinding(storage.local, domain, 'masterSwitch')
  return masterSwitchToggle
}

const createSubswitchesContainer = async (domain: string): Promise<HTMLElement> => {
  const subswitchesContainer = document.createElement('div')
  subswitchesContainer.className = 'subswitches-container'
  const keyPath = [SETTINGS_KEY_PREFIX, domain, 'masterSwitch']
  const updateOpacity = async () => {
    const masterSwitchValue = await storage.local.get(keyPath)
    subswitchesContainer.style.opacity = masterSwitchValue === false ? '0.4' : '1';
    subswitchesContainer.style.pointerEvents = masterSwitchValue === false ? 'none' : 'auto';
  }
  await updateOpacity()
  storage.local.listenForChanges(keyPath, () => handleAsync(updateOpacity))
  return subswitchesContainer
}

export const setupSettingsUI = async (domain: string): Promise<void> => {
  const settingsContainer = document.getElementById('settings')
  if (settingsContainer == null) {
    throw new Error('Settings container not found')
  }
  const masterSwitchToggle = await createMasterSwitch(domain)
  settingsContainer.appendChild(masterSwitchToggle)
  const subswitchesContainer = await createSubswitchesContainer(domain)
  settingsContainer.appendChild(subswitchesContainer)
  for (const [categoryId, settingIds] of objectEntries(PRIVACY_SETTINGS_CONFIG)) {
    const toggleCategory = await createToggleCategory(storage.local, domain, settingIds, categoryId)
    subswitchesContainer.appendChild(toggleCategory)
  }
}
