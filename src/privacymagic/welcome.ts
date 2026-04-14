import { handleAsync, logError } from '@src/common/util'
import { getDisableHistorySyncDone, onDisableHistorySyncDoneChanged } from '@src/common/disable-history-sync-done-state'

const BLANK_TAB_URL = 'about:blank'
const SYNC_HELP_SIDE_PANEL_PATH = 'privacymagic/sidepanel-sync-help.html'

const STEP_IDS = ['pin', 'vpn', 'disableHistorySync'] as const
type StepId = (typeof STEP_IDS)[number]

const getStepElement = (stepId: StepId): HTMLElement | null => {
  return document.getElementById(`step_${stepId}`)
}

const buildWelcomeInlineIconHtml = (altText: string, iconPath: string): string =>
  `<span style="unicode-bidi:isolate;display:inline-block;vertical-align:middle;margin:0 3px"><img src="${iconPath}" alt="${altText}" style="width:20px;height:20px;display:block;position:relative;top:-1px" /></span>`

const applyStep1MessageTokens = (): void => {
  const el = document.getElementById('welcomeStep1Body')
  if (el == null) {
    return
  }

  const raw = chrome.i18n.getMessage('welcomeStep1BodyWithIcons')
  const source = raw || el.innerHTML

  const puzzleIconAlt = chrome.i18n.getMessage('welcomePuzzleIconAlt') || 'puzzle icon'
  const pinIconAlt = chrome.i18n.getMessage('welcomePinIconAlt') || 'pin icon'

  const tokenMap: Record<string, string> = {
    puzzleIcon: buildWelcomeInlineIconHtml(puzzleIconAlt, '../assets/images/puzzle.svg'),
    pinIcon: buildWelcomeInlineIconHtml(pinIconAlt, '../assets/images/pin.svg'),
    hamsaIcon: buildWelcomeInlineIconHtml('Privacy Magic icon', '../logo/logo.svg')
  }

  const translated = source.replace(/\{([a-zA-Z0-9_]+)\}/g, (full: string, name: string) => tokenMap[name] ?? full)
  el.innerHTML = translated
}

const applyCompletedLabels = (): void => {
  const localized = chrome.i18n.getMessage('welcomeCompletedSuffix') || '(completed)'
  document.querySelectorAll<HTMLElement>('.step-title').forEach((title) => {
    title.setAttribute('data-completed-label', localized)
  })
}

const updateStep = (stepId: StepId, completed: boolean) => {
  const el = getStepElement(stepId)
  if (el == null) {
    return
  }
  if (completed) {
    el.classList.add('step-card-completed')
  } else {
    el.classList.remove('step-card-completed')
  }
}

chrome.action.onUserSettingsChanged.addListener(
  (details) => {
    console.log('User settings changed:', details);
    updateStep('pin', details.isOnToolbar ?? false)
  }
)

chrome.action.getUserSettings().then((userSettings) => {
  updateStep('pin', userSettings.isOnToolbar ?? false)
}).catch((error) => {
  console.error('Error getting user settings:', error)
})

getStepElement('vpn')?.querySelector('.btn-secondary')?.addEventListener('click', (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  updateStep('vpn', true)
})

getStepElement('disableHistorySync')?.querySelector('.btn-primary')
  ?.addEventListener('click', (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    handleAsync(async () => {
      const tab = await chrome.tabs.create({ url: BLANK_TAB_URL, active: true })
      const tabId = tab.id
      if (tabId == null) {
        throw new Error('New tab has no id')
      }
      await chrome.sidePanel.setOptions({
        tabId,
        path: `${SYNC_HELP_SIDE_PANEL_PATH}?tabId=${tabId}`,
        enabled: true
      })
      await chrome.sidePanel.open({ tabId })
      updateStep('disableHistorySync', true)
    }, (error) => {
      logError(error, 'error opening sync settings and side panel', event)
    })
  })

getStepElement('disableHistorySync')?.querySelector('.btn-secondary')
 ?.addEventListener('click', (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  updateStep('disableHistorySync', true)
})

for (const step of STEP_IDS) {
  getStepElement(step)?.addEventListener('click', (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    updateStep(step, false)
  })
}

applyStep1MessageTokens()
applyCompletedLabels()

handleAsync(async () => {
  if (await getDisableHistorySyncDone()) {
    updateStep('disableHistorySync', true)
  }
}, (error) => {
  logError(error, 'error reading welcome history-sync completion from storage')
})

onDisableHistorySyncDoneChanged((done) => {
  if (!done) {
    return
  }
  updateStep('disableHistorySync', true)
})

handleAsync(async () => {
  const { email, id } = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })
  if (email.length === 0 && id.length === 0) {
    // User is not signed in, so we can skip the step to
    // disable history syncing.
    updateStep('disableHistorySync', true)
  }
}, (error) => {
  logError(error, 'error checking profile sign-in for welcome step disableHistorySync')
})