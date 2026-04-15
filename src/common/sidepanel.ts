import { registrableDomainFromUrl } from "./registrable-domain"

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

const watchForNavigations = (tabId: number, originalDomain: string | null): void => {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.tabId !== tabId) {
      return
    }
    if (details.frameId !== 0 && details.frameId !== undefined) {
      return
    }
    const latestDomain = registrableDomainFromUrl(details.url)
    if (latestDomain !== originalDomain) {
      void chrome.sidePanel.setOptions({ enabled: false, tabId });
    }
  })
}

const watchForTabChanges = (tabId: number): void => {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId !== tabId) {
      void chrome.sidePanel.setOptions({ enabled: false });
    }
  })
}

export const prepareToCloseSidePanel = (tabId: number, domain: string | null): void => {
  watchForNavigations(tabId, domain)
  watchForTabChanges(tabId)
}