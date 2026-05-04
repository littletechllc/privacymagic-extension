import { handleAsync, logError } from '@src/common/util'
import { disableSyncSettingsDoneRemote } from '@src/common/messages'
import { prepareToCloseSidePanel, tabIdFromQuery } from '@src/common/sidepanel'

const SYNC_SETTINGS_URL = 'chrome://settings/syncSetup/advanced'

/** Which sync-help side panel body is visible. */
type SyncHelpMode = 'pending' | 'ready' | 'syncOff'

type SyncHelpDom = {
  pending: HTMLElement
  ready: HTMLElement
  syncOffPhase: HTMLElement
  headingDefault: HTMLElement
  headingSyncOff: HTMLElement
}

const setSyncHelpMode = (mode: SyncHelpMode, dom: SyncHelpDom): void => {
  dom.pending.hidden = mode !== 'pending'
  dom.ready.hidden = mode !== 'ready'
  dom.syncOffPhase.hidden = mode !== 'syncOff'
  dom.headingDefault.hidden = mode === 'syncOff'
  dom.headingSyncOff.hidden = mode !== 'syncOff'
}

const wireFinishSetupButtons = (): void => {
  document.querySelectorAll<HTMLButtonElement>('.sync-help-finish-setup-btn').forEach((btn) => {
    btn.addEventListener('click', (event: Event) => {
      event.preventDefault()
      handleAsync(async () => {
        await disableSyncSettingsDoneRemote(tabIdFromQuery())
      }, (error) => {
        logError(error, 'error finishing sync help side panel (all done / return to setup)', event)
      })
    })
  })
}

const checkIfSyncIsEnabled = async (tabId: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const start = Date.now()
    const interval = setInterval(() => {
      chrome.tabs.get(tabId, (tab) => {
        const redirected = tab.url !== 'chrome://settings/syncSetup/advanced' && tab.url === 'chrome://settings/syncSetup'
        const timedOut = Date.now() - start > 1000
        if (redirected || timedOut) {
          clearInterval(interval)
          resolve(!redirected)
        }
      })
    }, 50)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const tabId = tabIdFromQuery()
  const pending = document.getElementById('syncHelpPhasePending')
  const ready = document.getElementById('syncHelpPhaseReady')
  const syncOffPhase = document.getElementById('syncHelpPhaseSyncOff')
  const headingDefault = document.getElementById('syncHelpHeadingDefault')
  const headingSyncOff = document.getElementById('syncHelpHeadingSyncOff')
  const openBtn = document.getElementById('syncHelpOpenSettingsBtn')

  if (pending == null || ready == null || syncOffPhase == null || headingDefault == null || headingSyncOff == null || openBtn == null) {
    return
  }

  const dom: SyncHelpDom = { pending, ready, syncOffPhase, headingDefault, headingSyncOff }

  setSyncHelpMode('pending', dom)

  openBtn.addEventListener('click', (event: Event) => {
    handleAsync(async () => {
      await chrome.tabs.update(tabId, { url: SYNC_SETTINGS_URL })
      setSyncHelpMode('ready', dom)
      void checkIfSyncIsEnabled(tabId).then((syncIsEnabled) => {
        if (!syncIsEnabled) {
          setSyncHelpMode('syncOff', dom)
        }
      })
    }, (error) => {
      logError(error, 'error navigating to sync settings from side panel', event)
    })
  })

  wireFinishSetupButtons()
  prepareToCloseSidePanel(tabId, null)
})
