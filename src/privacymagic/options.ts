import { setupSettingsUI } from '../common/settings-ui'
import { setupPrefsUI } from './prefs-ui'
import { resetAllPrefsToDefaults } from '../common/prefs'
import { resetAllSettingsToDefaults, ALL_DOMAINS } from '../common/settings'
import { handleAsync, logError } from '../common/util'

document.addEventListener('DOMContentLoaded', (event) => handleAsync(async () => {
  document.getElementById('reset-all')?.addEventListener('click', () => handleAsync(async () => {
    await resetAllPrefsToDefaults()
    await resetAllSettingsToDefaults(ALL_DOMAINS)
  }, (error: unknown) => {
    logError(error, 'error resetting all prefs and settings to defaults', event)
  }))
  await setupPrefsUI()
  await setupSettingsUI(ALL_DOMAINS)
}, (error: unknown) => {
  logError(error, 'error setting up options page', event)
}))
