import { setupSettingsUI } from '@src/common/settings-ui'
import { handleAsync, logError } from '@src/common/util'
import { registrableDomainFromUrl } from '@src/common/registrable-domain'
import { updateSiteInfo } from '@src/common/site-info'
import { prepareToCloseSidePanel } from '@src/common/sidepanel'

const updateUI = async (domain: string): Promise<void> => {
  await setupSettingsUI(domain)
  await updateSiteInfo(domain)
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

document.addEventListener('DOMContentLoaded', (event) => handleAsync(async () => {
  const tabIdString = new URL(window.location.href).searchParams.get('tabId')
  if (tabIdString == null) {
    throw new Error('tabId is required')
  }
  const tabId = parseInt(tabIdString)
  if (isNaN(tabId)) {
    throw new Error('tabId is not a number')
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab == null) {
    throw new Error('No active tab found')
  }
  const domain = registrableDomainFromUrl(tab.url ?? '')
  if (domain != null) {
    await updateUI(domain)
  }
  prepareToCloseSidePanel(tabId, domain)
  if (domain == null) {
    return
  }
  setupGlobalOptionsLink()
}, (error: unknown) => {
  logError(error, 'error setting up sidepanel', event)
}))