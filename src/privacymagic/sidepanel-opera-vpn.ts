import { operaVpnHelpDoneRemote } from '@src/common/messages-to-background'
import { handleAsync, logError } from '@src/common/util'
import { prepareToCloseSidePanel, tabIdFromQuery } from '@src/privacymagic/sidepanel-helpers'

const OPERA_VPN_SETTINGS_URL = 'chrome://settings/vpn'

const tabId = tabIdFromQuery()
prepareToCloseSidePanel(tabId, null)

const pendingPhase = document.getElementById('operaVpnHelpPhasePending')
const readyPhase = document.getElementById('operaVpnHelpPhaseReady')
const openBtn = document.getElementById('operaVpnHelpOpenSettingsBtn')
const doneBtn = document.getElementById('operaVpnHelpDoneBtn')

const setVpnHelpMode = (mode: 'pending' | 'ready'): void => {
  if (pendingPhase != null) {
    pendingPhase.hidden = mode !== 'pending'
  }
  if (readyPhase != null) {
    readyPhase.hidden = mode !== 'ready'
  }
}

setVpnHelpMode('pending')

if (openBtn instanceof HTMLButtonElement) {
  openBtn.addEventListener('click', (event: Event) => {
    handleAsync(async () => {
      await chrome.tabs.update(tabId, { url: OPERA_VPN_SETTINGS_URL })
      setVpnHelpMode('ready')
    }, (error) => {
      logError(error, 'error opening Opera VPN settings from side panel', event)
    })
  })
}

if (doneBtn instanceof HTMLButtonElement) {
  doneBtn.addEventListener('click', (event: Event) => {
    handleAsync(async () => {
      await operaVpnHelpDoneRemote(tabId)
    }, (error) => {
      logError(error, 'error finishing Opera VPN help', event)
    })
  })
}
