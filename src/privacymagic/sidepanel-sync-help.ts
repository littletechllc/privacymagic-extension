import { handleAsync, logError } from '@src/common/util'
import { disableSyncSettingsDoneRemote } from '@src/common/messages'
import { prepareToCloseSidePanel, tabIdFromQuery } from '@src/common/sidepanel'

const ACCOUNT_SETTINGS_URL = 'chrome://settings/account'
const SYNC_SETUP_URL = 'chrome://settings/syncSetup'
const SYNC_SETUP_ADVANCED_URL = 'chrome://settings/syncSetup/advanced'
const GOOGLE_SERVICES_URL = 'chrome://settings/googleServices'

/** First-phase settings URLs to try, in order (UNO/account, then legacy sync). */
const HISTORY_SYNC_SETTINGS_URLS = [
  ACCOUNT_SETTINGS_URL,
  SYNC_SETUP_ADVANCED_URL,
] as const

/** Second-phase settings URLs: UNO googleServices, then legacy syncSetup (with search deep link). */
const googleServicesSettingsUrls = (): readonly string[] => {
  // Chrome Settings uses ?search= to highlight/scroll to matching controls on the page.
  const firstToggleLabel = chrome.i18n.getMessage('chromium_447252321002412580')
  const syncSetupUrl = firstToggleLabel === ''
    ? SYNC_SETUP_URL
    : `${SYNC_SETUP_URL}?search=${encodeURIComponent(firstToggleLabel)}`
  return [GOOGLE_SERVICES_URL, syncSetupUrl]
}

type HistorySyncSettingsUrl = (typeof HISTORY_SYNC_SETTINGS_URLS)[number]

/** Which sync-help side panel body is visible. */
type SyncHelpMode = 'pending' | 'ready' | 'syncOff' | 'googleServices'

type SyncHelpDom = {
  pending: HTMLElement
  ready: HTMLElement
  syncOffPhase: HTMLElement
  googleServicesPhase: HTMLElement
  headingDefault: HTMLElement
  headingProgress: HTMLElement
  headingSyncOff: HTMLElement
  customizeSyncSection: HTMLElement
  historyInstructionLegacy: HTMLElement
  historyInstructionAccount: HTMLElement
  historyPreviewHeading: HTMLElement
  historyLabelLegacy: HTMLElement
  historyLabelAccount: HTMLElement
}

const SYNC_HELP_PHASE_COUNT = 2

const setSyncHelpMode = (mode: SyncHelpMode, dom: SyncHelpDom): void => {
  dom.pending.hidden = mode !== 'pending'
  dom.ready.hidden = mode !== 'ready'
  dom.syncOffPhase.hidden = mode !== 'syncOff'
  dom.googleServicesPhase.hidden = mode !== 'googleServices'
  dom.headingDefault.hidden = mode !== 'pending' && mode !== 'ready' && mode !== 'googleServices'
  dom.headingSyncOff.hidden = mode !== 'syncOff'

  if (mode === 'ready') {
    dom.headingProgress.hidden = false
    dom.headingProgress.textContent = ` (1/${SYNC_HELP_PHASE_COUNT})`
  } else if (mode === 'googleServices') {
    dom.headingProgress.hidden = false
    dom.headingProgress.textContent = ` (2/${SYNC_HELP_PHASE_COUNT})`
  } else {
    dom.headingProgress.hidden = true
  }
}

/** UNO account page has no Customize sync radios and uses "History and tabs". */
const setReadyPhaseVariant = (url: HistorySyncSettingsUrl, dom: SyncHelpDom): void => {
  const isAccountPage = url === ACCOUNT_SETTINGS_URL
  dom.customizeSyncSection.hidden = isAccountPage
  dom.historyInstructionLegacy.hidden = isAccountPage
  dom.historyInstructionAccount.hidden = !isAccountPage
  dom.historyPreviewHeading.hidden = isAccountPage
  dom.historyLabelLegacy.hidden = isAccountPage
  dom.historyLabelAccount.hidden = !isAccountPage
}

const goToGoogleServices = async (tabId: number, dom: SyncHelpDom): Promise<void> => {
  await tryOpenSettingsUrls(tabId, googleServicesSettingsUrls())
  setSyncHelpMode('googleServices', dom)
}

const wireContinueToGoogleServicesButtons = (tabId: number, dom: SyncHelpDom): void => {
  document.querySelectorAll<HTMLButtonElement>('.sync-help-continue-btn').forEach((btn) => {
    btn.addEventListener('click', (event: Event) => {
      event.preventDefault()
      handleAsync(async () => {
        await goToGoogleServices(tabId, dom)
      }, (error) => {
        logError(error, 'error navigating to Google services settings from side panel', event)
      })
    })
  })
}

const wireFinishSetupButtons = (): void => {
  document.querySelectorAll<HTMLButtonElement>('.sync-help-finish-setup-btn').forEach((btn) => {
    btn.addEventListener('click', (event: Event) => {
      event.preventDefault()
      handleAsync(async () => {
        await disableSyncSettingsDoneRemote(tabIdFromQuery())
      }, (error) => {
        logError(error, 'error finishing sync help side panel (all done)', event)
      })
    })
  })
}

/** True if url is chrome://settings/syncSetup with optional query/hash (not /advanced). */
const isSyncSetupPageUrl = (url: string): boolean => {
  return url === SYNC_SETUP_URL ||
    url.startsWith(`${SYNC_SETUP_URL}?`) ||
    url.startsWith(`${SYNC_SETUP_URL}#`)
}

/** True if the tab URL is still on the navigated settings target (not a bounce). */
const isOnSettingsUrl = (tabUrl: string | undefined, targetUrl: string): boolean => {
  if (tabUrl == null) {
    return false
  }
  // /syncSetup (?search=…) must not match /syncSetup/advanced.
  if (isSyncSetupPageUrl(targetUrl)) {
    return isSyncSetupPageUrl(tabUrl)
  }
  return tabUrl.startsWith(targetUrl)
}

const checkIfStayedOnUrl = async (tabId: number, targetUrl: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const start = Date.now()
    const interval = setInterval(() => {
      chrome.tabs.get(tabId, (tab) => {
        const onTarget = isOnSettingsUrl(tab.url, targetUrl)
        const leftTarget = tab.url != null && !onTarget
        const timedOut = Date.now() - start > 500
        if (leftTarget || timedOut) {
          clearInterval(interval)
          resolve(onTarget)
        }
      })
    }, 50)
  })
}

/** Opens each URL in order; returns the first that sticks, or null. */
const tryOpenSettingsUrls = async <T extends string>(
  tabId: number,
  urls: readonly T[]
): Promise<T | null> => {
  for (const url of urls) {
    await chrome.tabs.update(tabId, { url })
    if (await checkIfStayedOnUrl(tabId, url)) {
      return url
    }
  }
  return null
}

/** Opens each history-sync settings URL in order; returns the URL that stuck, or null. */
const tryOpenHistorySyncSettings = async (
  tabId: number
): Promise<HistorySyncSettingsUrl | null> => {
  return tryOpenSettingsUrls(tabId, HISTORY_SYNC_SETTINGS_URLS)
}

document.addEventListener('DOMContentLoaded', () => {
  const tabId = tabIdFromQuery()
  const pending = document.getElementById('syncHelpPhasePending')
  const ready = document.getElementById('syncHelpPhaseReady')
  const syncOffPhase = document.getElementById('syncHelpPhaseSyncOff')
  const googleServicesPhase = document.getElementById('syncHelpPhaseGoogleServices')
  const headingDefault = document.getElementById('syncHelpHeadingDefault')
  const headingProgress = document.getElementById('syncHelpHeadingProgress')
  const headingSyncOff = document.getElementById('syncHelpHeadingSyncOff')
  const customizeSyncSection = document.getElementById('syncHelpCustomizeSyncSection')
  const historyInstructionLegacy = document.getElementById('syncHelpHistoryInstructionLegacy')
  const historyInstructionAccount = document.getElementById('syncHelpHistoryInstructionAccount')
  const historyPreviewHeading = document.getElementById('syncHelpHistoryPreviewHeading')
  const historyLabelLegacy = document.getElementById('syncHelpHistoryLabelLegacy')
  const historyLabelAccount = document.getElementById('syncHelpHistoryLabelAccount')
  const openBtn = document.getElementById('syncHelpOpenSettingsBtn')

  if (
    pending == null ||
    ready == null ||
    syncOffPhase == null ||
    googleServicesPhase == null ||
    headingDefault == null ||
    headingProgress == null ||
    headingSyncOff == null ||
    customizeSyncSection == null ||
    historyInstructionLegacy == null ||
    historyInstructionAccount == null ||
    historyPreviewHeading == null ||
    historyLabelLegacy == null ||
    historyLabelAccount == null ||
    openBtn == null
  ) {
    return
  }

  const dom: SyncHelpDom = {
    pending,
    ready,
    syncOffPhase,
    googleServicesPhase,
    headingDefault,
    headingProgress,
    headingSyncOff,
    customizeSyncSection,
    historyInstructionLegacy,
    historyInstructionAccount,
    historyPreviewHeading,
    historyLabelLegacy,
    historyLabelAccount
  }

  setSyncHelpMode('pending', dom)

  openBtn.addEventListener('click', (event: Event) => {
    handleAsync(async () => {
      const historySyncSettingsUrl = await tryOpenHistorySyncSettings(tabId)
      if (historySyncSettingsUrl != null) {
        setReadyPhaseVariant(historySyncSettingsUrl, dom)
        setSyncHelpMode('ready', dom)
      } else {
        await goToGoogleServices(tabId, dom)
      }
    }, (error) => {
      logError(error, 'error navigating to history sync settings from side panel', event)
    })
  })

  wireContinueToGoogleServicesButtons(tabId, dom)
  wireFinishSetupButtons()
  prepareToCloseSidePanel(tabId, null)
})
