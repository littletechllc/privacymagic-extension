import { PRIVACY_PREFS_CONFIG, getPref, setPref, listenForPrefChanges, type PrefName } from '../common/prefs'
import { createToggle } from '../common/toggle'
import { logError, entries } from '../common/util'

const bindPrefToCheckbox = async (toggle: HTMLElement, prefName: PrefName, inverted: boolean) => {
  const value = await getPref(prefName)
  const input: HTMLInputElement | null = toggle.querySelector('input')
  if (input == null) {
    throw new Error('Input element not found')
  }
  input.checked = inverted ? !value : value
  input.addEventListener('change', (event: Event) => {
    try {
      const value = input.checked
      setPref(prefName, inverted ? !value : value)
    } catch (error) {
      logError(error, 'error responding to click on pref checkbox', event)
    }
  })
  listenForPrefChanges(prefName, (value: boolean) => {
    input.checked = inverted ? !value : value
  })
}

export const setupPrefsUI = async () => {
  const prefsContainer = document.getElementById('prefs')
  if (prefsContainer == null) {
    throw new Error('Prefs container not found')
  }
  // Clear container and add title
  prefsContainer.innerHTML = '<h1>Browser Preferences</h1>'
  // Create toggles for each preference
  for (const [prefName, { locked, inverted }] of entries(PRIVACY_PREFS_CONFIG)) {
    const toggle = await createToggle(prefName, locked)
    await bindPrefToCheckbox(toggle, prefName, inverted)
    prefsContainer.appendChild(toggle)
  }
}
