import { handleAsync, logError } from '@src/common/util'
import { updateSiteInfo } from '@src/common/site-info'
import { getDomainForTabMessageRemote } from '@src/common/messages'
import { createMasterSwitch } from '@src/common/settings-ui'

const setupAdvancedSettingsLink = (): void => {
  const safeLocalPage = document.getElementById('safeLocalPage') as HTMLElement
  safeLocalPage.style.display = 'none'
  const advancedSettingsLinkContainer = document.getElementById('advancedSettingsLinkContainer') as HTMLElement
  advancedSettingsLinkContainer.style.display = 'flex'
  advancedSettingsLinkContainer.addEventListener('click', (event) => {
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
      await chrome.sidePanel.setOptions({
        tabId,
        path: `privacymagic/sidepanel.html?tabId=${tabId}`,
        enabled: true
      });
      await chrome.sidePanel.open({ tabId })
      window.close()
    }, (error) => {
      logError(error, 'error opening advanced settings page', event)
    })
  })
}

document.addEventListener('DOMContentLoaded', (event: Event) => handleAsync(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab == null) {
    throw new Error('No active tab found')
  }
  const tabId = tab.id
  if (tabId == null) {
    throw new Error('No active tab found')
  }
  const domain = await getDomainForTabMessageRemote(tabId)
  if (domain == null) {
    return
  }
  await updateSiteInfo(domain)
  const masterSwitchToggle = await createMasterSwitch(domain)
  const toggleContainer = document.querySelector('.toggle-container')
  toggleContainer?.appendChild(masterSwitchToggle)
  setupAdvancedSettingsLink()
}, (error: unknown) => {
  logError(error, 'error responding to DOMContentLoaded on current tab', event)
}))
