import { setupSettingsUI, createMasterSwitch } from '@src/common/settings-ui'
import { handleAsync, logError } from '@src/common/util'
import { getDomainForTabMessageRemote } from '@src/common/messages'
import { updateSiteInfo } from '@src/common/site-info'

const updateUI = async (tabId: number): Promise<string> => {
  const domain = await getDomainForTabMessageRemote(tabId)
  if (domain == null) {
    throw new Error('domain not found')
  }
  await setupSettingsUI(domain)
  await updateSiteInfo(domain)
  return domain
}

const watchForNavigations = (tabId: number, originalDomain: string): void => {
  chrome.webNavigation.onCommitted.addListener((details) => handleAsync(
    async () => {
      if (details.tabId !== tabId) {
        return
      }
      if (details.frameId !== 0 && details.frameId !== undefined) {
        return
      }
      const latestDomain = await getDomainForTabMessageRemote(tabId)
      if (latestDomain !== originalDomain) {
        void chrome.sidePanel.setOptions({ enabled: false, tabId });
      }
    }, (error: unknown) => {
      logError(error, 'error watching for navigations', details)
    })
  )
}

const watchForTabChanges = (tabId: number): void => {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId !== tabId) {
      void chrome.sidePanel.setOptions({ enabled: false });
    }
  })
}

const setupGlobalOptionsButton = (): void => {
  document.getElementById('globalOptionsButton')?.addEventListener('click', (event) => {
    try {
      console.log('globalOptionsButton clicked')
      void chrome.runtime.openOptionsPage()
    } catch (error) {
      logError(error, 'error opening global options page', event)
    }
  })
}

document.addEventListener('DOMContentLoaded', (event) => handleAsync(async () => {
  const tabIdString = new URL(window.location.href).searchParams.get('tabId')
  if (tabIdString == null) {
    throw new Error('tabId is required')
  }
  const tabId = parseInt(tabIdString)
  if (isNaN(tabId)) {
    throw new Error('tabId is not a number')
  }
  const originalDomain = await updateUI(tabId)
  watchForNavigations(tabId, originalDomain)
  watchForTabChanges(tabId)
  setupGlobalOptionsButton()
}, (error: unknown) => {
  logError(error, 'error setting up sidepanel', event)
}))