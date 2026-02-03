import { createToggleWithBinding } from '@src/common/settings-ui'
import { handleAsync, logError } from '@src/common/util'
import { updateSiteInfo } from '@src/common/site-info'
import { getDomainForTabMessageRemote } from '@src/common/messages'
import { storage } from '@src/common/storage'

const setupAdvancedSettingsButton = (): void => {
  document.getElementById('advancedSettingsButton')?.addEventListener('click', (event) => {
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
  setupAdvancedSettingsButton()
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
  await updateSiteInfo(domain)
  const masterSwitchToggle = await createToggleWithBinding(storage.local, domain, 'masterSwitch')
  const toggleContainer = document.querySelector('.toggle-container')
  toggleContainer?.appendChild(masterSwitchToggle)
}, (error: unknown) => {
  logError(error, 'error responding to DOMContentLoaded on current tab', event)
}))
