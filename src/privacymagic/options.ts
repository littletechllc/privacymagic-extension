import { setupPrefsUI } from './prefs-ui'
import { resetAllPrefsToDefaults } from '@src/common/prefs'
import { resetAllSettingsToRemote } from '@src/background/settings-write'
import { handleAsync, logError } from '@src/common/util'

document.addEventListener('DOMContentLoaded', (event) => handleAsync(async () => {
  document.getElementById('reset-all')?.addEventListener('click', () => handleAsync(async () => {
    await resetAllPrefsToDefaults()
    await resetAllSettingsToRemote()
  }, (error: unknown) => {
    logError(error, 'error resetting all prefs and settings to defaults', event)
  }))
  await setupPrefsUI()
}, (error: unknown) => {
  logError(error, 'error setting up options page', event)
}))
