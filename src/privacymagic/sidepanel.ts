import { setupSettingsUI } from '@src/common/settings-ui'
import { handleAsync, logError } from '@src/common/util'
import { getRegistrableDomainRemote } from '@src/common/messages-to-background'
import { updateSiteInfo } from '@src/common/site-info'
import { prepareToCloseSidePanel } from '@src/privacymagic/sidepanel-helpers'

const updateUI = async (domain: string, pageUrl: string): Promise<void> => {
  updateSiteInfo(domain, pageUrl)
  await setupSettingsUI(domain)
}

const setupGlobalOptionsLink = (): void => {
  document.getElementById('globalOptionsLinkContainer')?.addEventListener('click', (event) => {
    try {
      void chrome.runtime.openOptionsPage()
    } catch (error) {
      logError(error, 'error opening global options page', event)
    }
  })
}

const makeSiteSettingsVisible = (visible: boolean): void => {
  const mainContainer = document.querySelector('.main-container')
  if (mainContainer != null) {
    (mainContainer as HTMLElement).style.display = visible ? 'block' : 'none'
  }
}

const setupSidePanel = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab == null) {
    throw new Error('No active tab found')
  }
  const tabId = tab.id
  if (tabId == null) {
    throw new Error('No active tab found')
  }
  const pageUrl = tab.url ?? ''
  const domain = await getRegistrableDomainRemote(pageUrl)
  if (domain == null) {
    makeSiteSettingsVisible(false)
    return
  }
  await updateUI(domain, pageUrl)
  makeSiteSettingsVisible(true)
}

const runSetupSidePanel = (event: Event): void => {
  handleAsync(async () => {
    await setupSidePanel()
  }, (error: unknown) => {
    logError(error, 'error setting up sidepanel', event)
  })
}

document.addEventListener('DOMContentLoaded', (event) => {
  setupGlobalOptionsLink()
  handleAsync(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    if (tab == null) {
      throw new Error('No active tab found')
    }
    const tabId = tab.id
    if (tabId == null) {
      throw new Error('No active tab found')
    }
    const domain = await getRegistrableDomainRemote(tab.url ?? '')
    prepareToCloseSidePanel(tabId, domain)
    await setupSidePanel()
  }, (error: unknown) => {
    logError(error, 'error setting up sidepanel', event)
  })
})

document.addEventListener('visibilitychange', (event) => {
  makeSiteSettingsVisible(false)
  if (document.visibilityState === 'visible') {
    runSetupSidePanel(event)
  }
})
