import { registrableDomainFromUrl, logError, handleAsync } from '@src/common/util'
import { getSetting } from '@src/common/settings'

const fileExists = async (path: string): Promise<boolean> => {
  try {
    const url = chrome.runtime.getURL(path)
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

let listener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null

export const injectCssForCosmeticFilters = (): void => {
  const newListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => handleAsync(async () => {
    // Get the top level domain of the current tab.
    let url = details.url
    if (details.frameId !== 0 && details.frameId !== undefined) {
      const tab = await chrome.tabs.get(details.tabId)
      if (tab.url !== undefined && tab.url !== '') {
        url = tab.url
      }
    }
    const topLevelDomain = registrableDomainFromUrl(url)
    if (topLevelDomain === null) {
      return
    }
    const masterSwitch = await getSetting(topLevelDomain, 'masterSwitch')
    if (!masterSwitch) {
      return
    }
    const setting = await getSetting(topLevelDomain, 'ads')
    if (!setting) {
      return
    }
    const files = [
      'content_scripts/adblock_css/_default_.css'
    ]
    const frameDomain = registrableDomainFromUrl(details.url)
    if (frameDomain === null) {
      return
    }
    const domainSpecificFile = `content_scripts/adblock_css/${frameDomain}_.css`
    if (await fileExists(domainSpecificFile)) {
      files.push(domainSpecificFile)
    }
    await chrome.scripting.insertCSS({
      target: {
        tabId: details.tabId,
        frameIds: [details.frameId]
      },
      files
    })
    console.log('injected CSS for cosmetic filters for', frameDomain, files)
  }, (error: unknown) => {
    if (error instanceof Error) {
      if (error.message === `Frame with ID ${details.frameId} was removed.` ||
          error.message === `No tab with id: ${details.tabId}` ||
          error.message === `No frame with id ${details.frameId} in tab with id ${details.tabId}`) {
        // Ignore these errors.
        return
      }
      logError(error, 'error injecting CSS for cosmetic filters', details)
    }
  })
  if (listener !== null) {
    chrome.webNavigation.onCommitted.removeListener(listener)
  }
  chrome.webNavigation.onCommitted.addListener(newListener)
  listener = newListener
}
