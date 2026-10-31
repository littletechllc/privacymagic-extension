import { registrableDomainAsciiFromUrl } from '@src/common/registrable-domain'
import { handleAsync, logError } from '@src/common/util'
import { SIDE_PANEL_VISIBILITY_MESSAGE } from '@src/common/sidepanel-visibility-message'
import { updateSiteInfo } from '@src/common/site-info'
import { createMasterSwitch } from '@src/common/settings-ui'

const ADVANCED_SIDE_PANEL_PATH = 'privacymagic/sidepanel.html'
const REPORT_PROBLEM_PATH = 'privacymagic/report.html'

/**
 * True only if a side panel context for this tab exists and reports
 * document.visibilityState === 'visible'. Needed because Edge can keep a
 * hidden SIDE_PANEL context after tab switches.
 */
const isAdvancedSidePanelVisibleForTab = async (tabId: number): Promise<boolean> => {
  const baseUrl = chrome.runtime.getURL(ADVANCED_SIDE_PANEL_PATH)
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.SIDE_PANEL]
  })
  const hasContext = contexts.some((ctx) => {
    const url = ctx.documentUrl
    if (url == null || !url.startsWith(baseUrl)) {
      return false
    }
    return new URL(url).searchParams.get('tabId') === String(tabId)
  })
  if (!hasContext) {
    return false
  }
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: SIDE_PANEL_VISIBILITY_MESSAGE,
      tabId
    })
    return (
      typeof response === 'object' &&
      response !== null &&
      'visible' in response &&
      response.visible === true
    )
  } catch {
    return false
  }
}

const setupReportProblemLink = (domain: string): void => {
  document.getElementById('reportProblemLinkContainer')?.addEventListener('click', (event) => {
    handleAsync(async () => {
      const url = new URL(chrome.runtime.getURL(REPORT_PROBLEM_PATH))
      url.searchParams.set('domain', domain)
      await chrome.tabs.create({ url: url.href })
      window.close()
    }, (error) => {
      logError(error, 'error opening report problem page', event)
    })
  })
}

const setupContinueSetupLink = (): void => {
  document.getElementById('continueSetupLinkContainer')?.addEventListener('click', (event) => {
    handleAsync(async () => {
      await chrome.tabs.create({ url: chrome.runtime.getURL('privacymagic/setup.html') })
      window.close()
    }, (error) => {
      logError(error, 'error opening setup page', event)
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
      if (await isAdvancedSidePanelVisibleForTab(tabId)) {
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

const tabFromPopupContext = async (): Promise<chrome.tabs.Tab> => {
  const rawTabId = new URLSearchParams(window.location.search).get('tabId')
  if (rawTabId != null) {
    const tabId = parseInt(rawTabId, 10)
    if (Number.isNaN(tabId)) {
      throw new Error('tabId is not a number')
    }
    return await chrome.tabs.get(tabId)
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab == null) {
    throw new Error('No active tab found')
  }
  return tab
}

document.addEventListener('DOMContentLoaded', (event: Event) => handleAsync(async () => {
  const tab = await tabFromPopupContext()
  const tabId = tab.id
  if (tabId == null) {
    throw new Error('No active tab found')
  }
  const domain = registrableDomainAsciiFromUrl(tab.url ?? '')
  setupContinueSetupLink()
  document.getElementById('popupLinks')!.hidden = false
  if (domain == null) {
    document.querySelector('.main-container')?.setAttribute('hidden', '')
    return
  }
  const safeLocalPage = document.getElementById('safeLocalPage') as HTMLElement
  safeLocalPage.hidden = true
  document.getElementById('reportProblemLinkContainer')!.hidden = false
  document.getElementById('advancedSettingsLinkContainer')!.hidden = false
  setupReportProblemLink(domain)
  setupAdvancedSettingsLink()
  updateSiteInfo(domain, tab.url ?? '')
  await setupMasterSwitch(domain)
}, (error: unknown) => {
  logError(error, 'error responding to DOMContentLoaded on current tab', event)
}))
