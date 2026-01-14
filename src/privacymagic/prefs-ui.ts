import { PRIVACY_PREFS_CONFIG, getPref, setPref, listenForPrefChanges, type PrefName } from '../common/prefs'
import { createToggle } from '../common/toggle'
import { logError, entries, handleAsync } from '../common/util'

const bindPrefToCheckbox = async (toggle: HTMLElement, prefName: PrefName, inverted: boolean): Promise<void> => {
  const value = await getPref(prefName)
  const input: HTMLInputElement | null = toggle.querySelector('input')
  if (input === null || input === undefined) {
    throw new Error('Input element not found')
  }
  input.checked = inverted ? !value : value
  input.addEventListener('change', (event: Event) => {
    handleAsync(async () => {
      const value = input.checked
      await setPref(prefName, inverted ? !value : value)
    }, (error: unknown) => {
      logError(error, 'error responding to click on pref checkbox', event)
    })
  })
  listenForPrefChanges(prefName, (value: boolean) => {
    input.checked = inverted ? !value : value
  })
}

export const setupPrefsUI = async (): Promise<void> => {
  const prefsContainer = document.getElementById('prefs')
  if (prefsContainer === null || prefsContainer === undefined) {
    throw new Error('Prefs container not found')
  }
  // Clear container and add title
  prefsContainer.innerHTML = '<h1>Browser Preferences</h1>'
  // Create toggles for each preference
  for (const [prefName, { locked, inverted }] of entries(PRIVACY_PREFS_CONFIG)) {
    const toggle = createToggle(prefName, locked)
    await bindPrefToCheckbox(toggle, prefName, inverted)
    prefsContainer.appendChild(toggle)
  }
}
