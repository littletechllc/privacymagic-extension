import { getRegistrableDomainRemote } from '@src/common/messages-to-background'
import { SIDE_PANEL_VISIBILITY_MESSAGE } from '@src/common/sidepanel-visibility-message'
import { handleAsync, logError } from '@src/common/util'

export const tabIdFromQuery = (): number => {
  const raw = new URLSearchParams(window.location.search).get('tabId')
  if (raw == null) {
    throw new Error('tabId is required')
  }
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) {
    throw new Error('tabId is not a number')
  }
  return n
}

/** Responds to popup/SW queries with whether this panel page is currently visible. */
const listenForSidePanelVisibilityQueries = (tabId: number): void => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== SIDE_PANEL_VISIBILITY_MESSAGE) {
      return
    }
    if (message.tabId !== tabId) {
      return
    }
    sendResponse({ visible: document.visibilityState === 'visible' })
  })
}

const watchForNavigations = (tabId: number, originalDomain: string | null): void => {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.tabId !== tabId) {
      return
    }
    if (details.frameId !== 0 && details.frameId !== undefined) {
      return
    }
    handleAsync(async () => {
      const latestDomain = await getRegistrableDomainRemote(details.url)
      if (latestDomain !== originalDomain) {
        void chrome.sidePanel.setOptions({ enabled: false, tabId })
      }
    }, (error) => {
      logError(error, 'getRegistrableDomainRemote in watchForNavigations', details)
    })
  })
}

const watchForTabChanges = (tabId: number): void => {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId !== tabId) {
      void chrome.sidePanel.setOptions({ enabled: false })
    }
  })
}

export const prepareToCloseSidePanel = (tabId: number, domain: string | null): void => {
  listenForSidePanelVisibilityQueries(tabId)
  watchForNavigations(tabId, domain)
  watchForTabChanges(tabId)
}
