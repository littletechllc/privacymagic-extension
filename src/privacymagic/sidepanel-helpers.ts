import { browserInfo } from '@src/common/browser'
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

/** Responds to popup queries with whether this panel page is currently visible. */
const listenForSidePanelVisibilityQueries = (tabId: number): void => {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (
      typeof message !== 'object' ||
      message === null ||
      !('type' in message) ||
      message.type !== SIDE_PANEL_VISIBILITY_MESSAGE
    ) {
      return
    }
    const tabIdInMessage = 'tabId' in message ? message.tabId : undefined
    if (tabIdInMessage !== tabId) {
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

/** Edge does not restore the side panel across tab switches; close it when leaving this tab. */
const watchForTabChanges = (tabId: number): void => {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId !== tabId) {
      void chrome.sidePanel.setOptions({ enabled: false, tabId })
    }
  })
}

export const prepareToCloseSidePanel = (tabId: number, domain: string | null): void => {
  listenForSidePanelVisibilityQueries(tabId)
  watchForNavigations(tabId, domain)
  if (browserInfo.brand === 'Edge') {
    watchForTabChanges(tabId)
  }
}
