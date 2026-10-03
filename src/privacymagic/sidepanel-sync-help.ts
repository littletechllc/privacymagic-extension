import { browserInfo } from '@src/common/browser'
import { handleAsync, logError } from '@src/common/util'
import { disableSyncSettingsDoneRemote } from '@src/common/messages-to-background'
import { prepareToCloseSidePanel, tabIdFromQuery } from '@src/privacymagic/sidepanel-helpers'

const ACCOUNT_SETTINGS_URL = 'chrome://settings/account'
const SYNC_SETUP_URL = 'chrome://settings/syncSetup'
const SYNC_SETUP_ADVANCED_URL = 'chrome://settings/syncSetup/advanced'
const GOOGLE_SERVICES_URL = 'chrome://settings/googleServices'
const EDGE_PRIVACY_URL = 'edge://settings/privacy/privacy'
const OPERA_PRIVACY_URL = 'opera://settings/privacy'

/** First-phase settings URLs to try, in order (UNO/account, then legacy sync). */
const HISTORY_SYNC_SETTINGS_URLS = [
  ACCOUNT_SETTINGS_URL,
  SYNC_SETUP_ADVANCED_URL,
] as const

/** Second-phase settings URLs: UNO googleServices, then legacy syncSetup (with text-fragment deep link). */
const googleServicesSettingsUrls = (): readonly string[] => {
  // Text fragments scroll/highlight matching copy on the page (search= often finds nothing on syncSetup).
  const firstToggleLabel = chrome.i18n.getMessage('chromium_447252321002412580')
  const syncSetupUrl = firstToggleLabel === ''
    ? SYNC_SETUP_URL
    : `${SYNC_SETUP_URL}#:~:text=${encodeURIComponent(firstToggleLabel)}`
  return [GOOGLE_SERVICES_URL, syncSetupUrl]
}

type HistorySyncSettingsUrl = (typeof HISTORY_SYNC_SETTINGS_URLS)[number]

/** Which sync-help side panel body is visible. */
type SyncHelpMode = 'pending' | 'ready' | 'syncOff' | 'googleServices' | 'edgePrivacy' | 'operaPrivacy'

type SyncHelpDom = {
  pending: HTMLElement
  ready: HTMLElement
  syncOffPhase: HTMLElement
  googleServicesPhase: HTMLElement
  edgePrivacyPhase: HTMLElement
  operaPrivacyPhase: HTMLElement
  headingDefault: HTMLElement
  headingProgress: HTMLElement
  headingSyncOff: HTMLElement
  customizeSyncSection: HTMLElement
  historyInstructionLegacy: HTMLElement
  historyInstructionAccount: HTMLElement
  historyPreviewHeading: HTMLElement
  historyLabelLegacy: HTMLElement
  historyLabelAccount: HTMLElement
  finishSetup: HTMLElement
}

const SYNC_HELP_PHASE_COUNT = 2

const setSyncHelpMode = (mode: SyncHelpMode, dom: SyncHelpDom): void => {
  dom.pending.hidden = mode !== 'pending'
  dom.ready.hidden = mode !== 'ready'
  dom.syncOffPhase.hidden = mode !== 'syncOff'
  dom.googleServicesPhase.hidden = mode !== 'googleServices'
  dom.edgePrivacyPhase.hidden = mode !== 'edgePrivacy'
  dom.operaPrivacyPhase.hidden = mode !== 'operaPrivacy'
  dom.finishSetup.hidden =
    mode !== 'googleServices' && mode !== 'edgePrivacy' && mode !== 'operaPrivacy'
  dom.headingDefault.hidden =
    mode !== 'pending' &&
    mode !== 'ready' &&
    mode !== 'googleServices' &&
    mode !== 'edgePrivacy' &&
    mode !== 'operaPrivacy'
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

/** Label for the side of the window where settings sit (opposite the side panel). */
const settingsPageSideLabel = async (): Promise<string> => {
  let panelSide: 'left' | 'right' = 'right'
  try {
    if (typeof chrome.sidePanel.getLayout === 'function') {
      const layout = await chrome.sidePanel.getLayout()
      if (layout.side === 'left' || layout.side === 'right') {
        panelSide = layout.side
      }
    }
  } catch {
    // Older Chrome or missing permission: assume default side panel on the right.
  }
  const settingsOnLeft = panelSide === 'right'
  const key = settingsOnLeft ? 'syncHelpDirectionLeft' : 'syncHelpDirectionRight'
  const fallback = settingsOnLeft ? 'left' : 'right'
  return chrome.i18n.getMessage(key) || fallback
}

/**
 * Chrome/Edge: "…settings page at left/right…".
 * Opera: getLayout() can crash the browser, so use direction-free copy.
 */
const applySettingsSideInstruction = async (elementId: string, messageKey: string): Promise<void> => {
  const el = document.getElementById(elementId)
  if (el == null) {
    return
  }
  const msg = browserInfo.brand === 'Opera'
    ? chrome.i18n.getMessage(`${messageKey}Neutral`)
    : chrome.i18n.getMessage(messageKey, [await settingsPageSideLabel()])
  if (msg !== '') {
    el.textContent = msg
  }
}

const applyGoogleServicesInstruction = async (): Promise<void> => {
  await applySettingsSideInstruction('syncHelpGoogleServicesInstruction', 'syncHelpGoogleServicesInstruction')
}

const applyEdgePrivacyInstruction = async (): Promise<void> => {
  await applySettingsSideInstruction('syncHelpEdgePrivacyInstruction', 'syncHelpEdgePrivacyInstruction')
}

const applyOperaPrivacyInstruction = async (): Promise<void> => {
  await applySettingsSideInstruction('syncHelpOperaPrivacyInstruction', 'syncHelpOperaPrivacyInstruction')
}

/** Edge has one privacy-settings step instead of Chrome's history-sync and Google-services steps. */
const edgePrivacySettingsUrl = (): string => {
  const firstToggleLabel = chrome.i18n.getMessage('edge_8757')
  if (firstToggleLabel === '') {
    return EDGE_PRIVACY_URL
  }
  return `${EDGE_PRIVACY_URL}#:~:text=${encodeURIComponent(firstToggleLabel)}`
}

/** Opera has one privacy-settings step instead of Chrome's history-sync and Google-services steps. */
const operaPrivacySettingsUrl = (): string => {
  const firstToggleLabel = chrome.i18n.getMessage('opera_55329')
  if (firstToggleLabel === '') {
    return OPERA_PRIVACY_URL
  }
  return `${OPERA_PRIVACY_URL}#:~:text=${encodeURIComponent(firstToggleLabel)}`
}

const goToEdgePrivacy = async (tabId: number, dom: SyncHelpDom): Promise<void> => {
  await chrome.tabs.update(tabId, { url: edgePrivacySettingsUrl() })
  await applyEdgePrivacyInstruction()
  setSyncHelpMode('edgePrivacy', dom)
}

const goToOperaPrivacy = async (tabId: number, dom: SyncHelpDom): Promise<void> => {
  const tab = await chrome.tabs.get(tabId)
  if (tab.url == null || !tab.url.startsWith(OPERA_PRIVACY_URL)) {
    await chrome.tabs.update(tabId, { url: operaPrivacySettingsUrl() })
  }
  await applyOperaPrivacyInstruction()
  setSyncHelpMode('operaPrivacy', dom)
}

const goToGoogleServices = async (tabId: number, dom: SyncHelpDom): Promise<void> => {
  await tryOpenSettingsUrls(tabId, googleServicesSettingsUrls())
  await applyGoogleServicesInstruction()
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

const wireFinishSetupButton = (finishSetupBtn: HTMLButtonElement): void => {
  finishSetupBtn.addEventListener('click', (event: Event) => {
    event.preventDefault()
    handleAsync(async () => {
      await disableSyncSettingsDoneRemote(tabIdFromQuery())
    }, (error) => {
      logError(error, 'error finishing sync help side panel (all done)', event)
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
        const timedOut = Date.now() - start > 1000
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
  const edgePrivacyPhase = document.getElementById('syncHelpPhaseEdgePrivacy')
  const operaPrivacyPhase = document.getElementById('syncHelpPhaseOperaPrivacy')
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
  const finishSetup = document.getElementById('syncHelpFinishSetup')
  const finishSetupBtn = document.getElementById('syncHelpFinishSetupBtn')

  if (
    pending == null ||
    ready == null ||
    syncOffPhase == null ||
    googleServicesPhase == null ||
    edgePrivacyPhase == null ||
    operaPrivacyPhase == null ||
    headingDefault == null ||
    headingProgress == null ||
    headingSyncOff == null ||
    customizeSyncSection == null ||
    historyInstructionLegacy == null ||
    historyInstructionAccount == null ||
    historyPreviewHeading == null ||
    historyLabelLegacy == null ||
    historyLabelAccount == null ||
    openBtn == null ||
    finishSetup == null ||
    !(finishSetupBtn instanceof HTMLButtonElement)
  ) {
    return
  }

  const dom: SyncHelpDom = {
    pending,
    ready,
    syncOffPhase,
    googleServicesPhase,
    edgePrivacyPhase,
    operaPrivacyPhase,
    headingDefault,
    headingProgress,
    headingSyncOff,
    customizeSyncSection,
    historyInstructionLegacy,
    historyInstructionAccount,
    historyPreviewHeading,
    historyLabelLegacy,
    historyLabelAccount,
    finishSetup
  }

  handleAsync(async () => {
    await applyGoogleServicesInstruction()
    await applyEdgePrivacyInstruction()
    await applyOperaPrivacyInstruction()
    // Opera opens opera://settings/privacy from setup in one step; show that phase immediately.
    if (browserInfo.brand === 'Opera') {
      await goToOperaPrivacy(tabId, dom)
      return
    }
    setSyncHelpMode('pending', dom)
  }, (error) => {
    logError(error, 'error applying settings instruction copy')
  })

  openBtn.addEventListener('click', (event: Event) => {
    handleAsync(async () => {
      if (browserInfo.brand === 'Edge') {
        await goToEdgePrivacy(tabId, dom)
        return
      }
      if (browserInfo.brand === 'Opera') {
        await goToOperaPrivacy(tabId, dom)
        return
      }
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
  wireFinishSetupButton(finishSetupBtn)
  prepareToCloseSidePanel(tabId, null)
})
