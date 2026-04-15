import { handleAsync, logError } from '@src/common/util'
import { disableSyncSettingsDoneRemote } from '@src/common/messages'
import { prepareToCloseSidePanel, tabIdFromQuery } from '@src/common/sidepanel'

const SYNC_SETTINGS_URL = 'chrome://settings/syncSetup/advanced'

document.addEventListener('DOMContentLoaded', () => {
  const tabId = tabIdFromQuery()
  const pending = document.getElementById('syncHelpPhasePending')
  const ready = document.getElementById('syncHelpPhaseReady')
  const openBtn = document.getElementById('syncHelpOpenSettingsBtn')
  const allDoneBtn = document.getElementById('syncHelpAllDoneBtn')

  if (pending == null || ready == null) {
    return
  }

  if (tabId == null || openBtn == null) {
    pending.hidden = true
    ready.hidden = false
  } else {
    openBtn.addEventListener('click', (event: Event) => {
      handleAsync(async () => {
        await chrome.tabs.update(tabId, { url: SYNC_SETTINGS_URL })
        pending.hidden = true
        ready.hidden = false
      }, (error) => {
        logError(error, 'error navigating to sync settings from side panel', event)
      })
    })
  }

  allDoneBtn?.addEventListener('click', (event: Event) => {
    event.preventDefault()
    const tabId = tabIdFromQuery()
    handleAsync(async () => {
      await disableSyncSettingsDoneRemote(tabId)
    }, (error) => {
      logError(error, 'error handling All done on sync help side panel', event)
    })
  })

  prepareToCloseSidePanel(tabId, null)
})
