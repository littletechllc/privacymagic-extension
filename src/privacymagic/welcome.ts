import { handleAsync, logError } from '@src/common/util'
import { getDisableHistorySyncDone, onDisableHistorySyncDoneChanged } from '@src/common/disable-history-sync-done-state'

const BLANK_TAB_URL = 'about:blank'
const SYNC_HELP_SIDE_PANEL_PATH = 'privacymagic/sidepanel-sync-help.html'

const buildWelcomeInlineIconHtml = (altText: string, iconPath: string): string =>
  `<img src="${iconPath}" alt="${altText}" style="width:20px; height:20px; display:inline-block; vertical-align:middle; position:relative; top:-1px; margin:0 3px;" />`

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

const updateStep = (stepId: number, completed: boolean) => {
  const el = document.getElementById(`step${stepId}`)
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
    updateStep(1, details.isOnToolbar ?? false)
  }
)

chrome.action.getUserSettings().then((userSettings) => {
  updateStep(1, userSettings.isOnToolbar ?? false)
}).catch((error) => {
  console.error('Error getting user settings:', error)
})

document.querySelector('#step2 .btn-secondary')
  ?.addEventListener('click', (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  updateStep(2, true)
})

document.querySelector('#step3 .btn-primary')
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
      updateStep(3, true)
    }, (error) => {
      logError(error, 'error opening sync settings and side panel', event)
    })
  })

document.querySelector('#step3 .btn-secondary')
 ?.addEventListener('click', (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  updateStep(3, true)
})

document.querySelectorAll('.step-header').forEach((stepHeader) => {
  stepHeader.addEventListener('click', (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    const card = stepHeader.closest('.step-card')
    if (card == null) {
      return
    }
    const m = /^step(\d+)$/.exec(card.id)
    if (m == null) {
      return
    }
    updateStep(parseInt(m[1], 10), false)
  })
})

applyStep1MessageTokens()
applyCompletedLabels()

handleAsync(async () => {
  if (await getDisableHistorySyncDone()) {
    updateStep(3, true)
  }
}, (error) => {
  logError(error, 'error reading welcome history-sync completion from storage')
})

onDisableHistorySyncDoneChanged((done) => {
  if (!done) {
    return
  }
  updateStep(3, true)
})

handleAsync(async () => {
  const { email, id } = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })
  if (email.length === 0 && id.length === 0) {
    // User is not signed in, so we can skip the step to
    // disable history syncing.
    updateStep(3, true)
  }
}, (error) => {
  logError(error, 'error checking profile sign-in for welcome step 3')
})