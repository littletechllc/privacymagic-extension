import { handleAsync, logError } from '@src/common/util'
import { getRegistrableDomainRemote } from '@src/common/messages'
import { updateSiteInfo } from '@src/common/site-info'
import { createMasterSwitch } from '@src/common/settings-ui'

const ADVANCED_SIDE_PANEL_PATH = 'privacymagic/sidepanel.html'

const isAdvancedSidePanelOpenForTab = async (tabId: number): Promise<boolean> => {
  const baseUrl = chrome.runtime.getURL(ADVANCED_SIDE_PANEL_PATH)
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.SIDE_PANEL]
  })
  return contexts.some((ctx) => {
    const url = ctx.documentUrl
    if (url == null || !url.startsWith(baseUrl)) {
      return false
    }
    return new URL(url).searchParams.get('tabId') === String(tabId)
  })
}

const setupContinueSetupLink = (): void => {
  document.getElementById('continueSetupLinkContainer')?.addEventListener('click', (event) => {
    handleAsync(async () => {
      await chrome.tabs.create({ url: 'privacymagic/welcome.html' })
      window.close()
    }, (error) => {
      logError(error, 'error opening welcome setup page', event)
    })
  })
}

const setupAdvancedSettingsLink = (): void => {
  document.getElementById('advancedSettingsLinkContainer')?.addEventListener('click', (event) => {
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
      if (await isAdvancedSidePanelOpenForTab(tabId)) {
        await chrome.sidePanel.close({ tabId })
      } else {
        await chrome.sidePanel.setOptions({
          tabId,
          path: `${ADVANCED_SIDE_PANEL_PATH}?tabId=${tabId}`,
          enabled: true
        })
        await chrome.sidePanel.open({ tabId })
      }
      window.close()
    }, (error) => {
      logError(error, 'error toggling advanced settings side panel', event)
    })
  })
}

const setupMasterSwitch = async (domain: string): Promise<void> => {
  const masterSwitchToggle = await createMasterSwitch(domain)
  const toggleContainer = document.querySelector('.toggle-container')
  toggleContainer?.appendChild(masterSwitchToggle)
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
  const domain = await getRegistrableDomainRemote(tab.url ?? '')
  if (domain == null) {
    return
  }
  const safeLocalPage = document.getElementById('safeLocalPage') as HTMLElement
  safeLocalPage.style.display = 'none'
  document.getElementById('advancedSettingsLinkContainer')!.hidden = false
  document.getElementById('popupLinks')!.hidden = false
  setupContinueSetupLink()
  setupAdvancedSettingsLink()
  await Promise.all([updateSiteInfo(domain), setupMasterSwitch(domain)])
}, (error: unknown) => {
  logError(error, 'error responding to DOMContentLoaded on current tab', event)
}))
