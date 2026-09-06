import { handleAsync, logError } from '@src/common/util'
import type { BooleanStorageFlag } from '@src/common/boolean-storage-flag'
import { setupHistorySyncStepDone, setupVpnStepDone } from '@src/common/setup-step-done-state'

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
  const el = document.getElementById('setupStep1Body')
  if (el == null) {
    return
  }

  const raw = chrome.i18n.getMessage('setupStep1BodyWithIcons')
  const source = raw || el.innerHTML

  const puzzleIconAlt = chrome.i18n.getMessage('setupPuzzleIconAlt') || 'puzzle icon'
  const pinIconAlt = chrome.i18n.getMessage('setupPinIconAlt') || 'pin icon'

  const tokenMap: Record<string, string> = {
    puzzleIcon: buildWelcomeInlineIconHtml(puzzleIconAlt, '../assets/images/puzzle.svg'),
    pinIcon: buildWelcomeInlineIconHtml(pinIconAlt, '../assets/images/pin.svg'),
    hamsaIcon: buildWelcomeInlineIconHtml('Privacy Magic icon', '../logo/logo.svg')
  }

  const translated = source.replace(/\{([a-zA-Z0-9_]+)\}/g, (full: string, name: string) => tokenMap[name] ?? full)
  el.innerHTML = translated
}

const applyCompletedLabels = (): void => {
  const localized = chrome.i18n.getMessage('setupCompletedSuffix') || '(completed)'
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
    el.classList.add('step-card-collapsed')
  } else {
    el.classList.remove('step-card-completed')
    el.classList.remove('step-card-collapsed')
  }
}

const toggleStepCollapsed = (stepId: StepId): void => {
  const el = getStepElement(stepId)
  if (el == null || !el.classList.contains('step-card-completed')) {
    return
  }
  el.classList.toggle('step-card-collapsed')
}

chrome.action.onUserSettingsChanged.addListener(
  (details) => {
    console.log('User settings changed:', details)
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
  handleAsync(async () => {
    await setupVpnStepDone.set(true)
    updateStep('vpn', true)
  }, (error) => {
    logError(error, 'error saving setup VPN step completion', event)
  })
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
  handleAsync(async () => {
    await setupHistorySyncStepDone.set(true)
    updateStep('disableHistorySync', true)
  }, (error) => {
    logError(error, 'error saving setup history-sync step completion', event)
  })
})

for (const step of STEP_IDS) {
  getStepElement(step)?.querySelector('.step-header')?.addEventListener('click', () => {
    toggleStepCollapsed(step)
  })
}

applyStep1MessageTokens()
applyCompletedLabels()

const restorePersistedStep = (
  flag: BooleanStorageFlag,
  stepId: StepId,
  readErrorMessage: string
): void => {
  handleAsync(async () => {
    if (await flag.get()) {
      updateStep(stepId, true)
    }
  }, (error) => {
    logError(error, readErrorMessage)
  })

  flag.onChanged((done) => {
    if (!done) {
      return
    }
    updateStep(stepId, true)
  })
}

restorePersistedStep(setupVpnStepDone, 'vpn', 'error reading setup VPN completion from storage')
restorePersistedStep(
  setupHistorySyncStepDone,
  'disableHistorySync',
  'error reading setup history-sync completion from storage'
)
