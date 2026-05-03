import { setupSettingsUI } from '@src/common/settings-ui'
import { handleAsync, logError } from '@src/common/util'
import { getRegistrableDomainRemote } from '@src/common/messages'
import { updateSiteInfo } from '@src/common/site-info'
import { prepareToCloseSidePanel, tabIdFromQuery } from '@src/common/sidepanel'

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
  const tabId = tabIdFromQuery()
  const tab = await chrome.tabs.get(tabId)
  if (tab == null) {
    throw new Error('No tab found')
  }
  const domain = await getRegistrableDomainRemote(tab.url ?? '')
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