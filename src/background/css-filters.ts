import { logError, handleAsync } from '@src/common/util'
import { registrableDomainFromUrl } from './registrable-domain'
import { getSettingDisabled } from '@src/common/settings-read'
import { COSMETIC_FILTERS_DIR } from '@src/common/filter-list-paths'
import { readIndexFile } from './filter-util'

const cosmeticFiltersListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => handleAsync(async () => {
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
  const masterSwitchDisabled = await getSettingDisabled(topLevelDomain, 'masterSwitch')
  if (masterSwitchDisabled) {
    return
  }
  const adsDisabled = await getSettingDisabled(topLevelDomain, 'ads')
  if (adsDisabled) {
    return
  }
  const files = []
  const availableDomains = await readIndexFile(COSMETIC_FILTERS_DIR)
  if (availableDomains.has('_default')) {
    files.push(`${COSMETIC_FILTERS_DIR}/_default_.css`)
  }
  const frameDomain = registrableDomainFromUrl(details.url)
  if (frameDomain === null) {
    return
  }
  if (availableDomains.has(frameDomain)) {
    files.push(`${COSMETIC_FILTERS_DIR}/${frameDomain}_.css`)
  }
  if (files.length === 0) {
    return
  }
  await chrome.scripting.insertCSS({
    target: {
      tabId: details.tabId,
      frameIds: [details.frameId]
    },
    files
  })
  console.log(`injected CSS for cosmetic filters for ${frameDomain}: ${files.join(', ')} in tab ${details.tabId} frame ${details.frameId}`)
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

export const injectCssForCosmeticFilters = (): void => {
  chrome.webNavigation.onCommitted.addListener(cosmeticFiltersListener)
}
