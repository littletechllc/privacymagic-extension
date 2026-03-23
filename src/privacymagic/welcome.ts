console.log('welcome.ts loaded');

const buildWelcomeInlineIconHtml = (altText: string, iconPath: string): string =>
  `<img src="${iconPath}" alt="${altText}" style="width:20px; height:20px; display:inline-block; vertical-align:middle; position:relative; top:-1px; margin:0 3px;" />`

const buildHamsaIconHtml = (): string =>
  `<svg viewBox="-15 95 105 125" xmlns="http://www.w3.org/2000/svg" width="20" height="20" style="display:inline-block; vertical-align:middle; position:relative; top:-1px; margin:0 3px;"><g transform="translate(6.60056,0.6882665)"><path fill="#0f3d72" d="m 33.69642,99.483523 c -7.67476,-0.002 -7.35765,8.160267 -7.30244,12.641607 -0.18534,12.94585 -0.21633,26.0355 -0.38189,38.9816 -1.36617,0.0384 -1.93514,0.0345 -3.11249,0.0165 -0.0326,-12.38815 -0.0781,-27.55861 -0.51987,-39.94072 -0.48834,-3.70581 -2.59806,-5.13258 -6.33453,-5.11545 -4.39162,0.0201 -5.81078,2.45532 -6.27717,5.48597 -0.81609,10.79484 -0.29735,21.63493 -0.7519,32.44557 -0.0734,5.41556 -0.1493,10.83127 -0.24133,16.24655 -2.84676,-4.67192 -8.70217,-10.69061 -14.86687,-11.32644 -5.09657,-0.58843 -6.94072,1.42229 -11.37043,3.65146 8.08098,0.22217 11.85647,7.36039 14.33098,16.04036 4.05089,11.87787 7.25503,23.7197 14.01732,34.53019 5.13548,6.05692 13.31801,10.05135 21.36884,9.93658 v 0.0295 c 0.0128,-4.2e-4 0.0248,-5.9e-4 0.0362,-0.001 8.96231,-0.055 17.89265,-2.45427 23.6974,-9.91668 6.76224,-10.81049 9.96638,-22.65232 14.01723,-34.53019 2.47451,-8.67997 6.24997,-15.8182 14.33091,-16.04037 -4.42969,-2.22917 -6.27383,-4.23988 -11.37036,-3.65145 -6.16468,0.63583 -12.02005,6.65452 -14.8668,11.32644 -0.092,-5.41528 -0.16792,-10.831 -0.24133,-16.24656 -0.45455,-10.81064 0.0642,-21.65074 -0.75189,-32.44556 -0.46638,-3.03064 -1.88556,-5.46588 -6.27717,-5.48598 -3.73647,-0.0171 -5.84619,1.40967 -6.33453,5.11546 -0.44176,12.38209 -0.48727,27.55256 -0.51987,39.94071 -1.17736,0.018 -1.74631,0.0219 -3.11249,-0.0165 -0.16555,-12.9461 -0.19655,-26.03577 -0.38189,-38.98161 0.0552,-4.48131 0.40738,-12.615667 -6.7836,-12.690177 z"/><ellipse fill="white" stroke="#0f3d72" stroke-width="2" cx="33.650284" cy="178.74698" rx="23" ry="14"/><circle fill="#0f3d72" cx="33.650284" cy="178.74698" r="9"/></g></svg>`

const applyStep1MessageTokens = (): void => {
  const el = document.getElementById('welcomeStep1Body')
  if (el == null) return

  const raw = chrome.i18n.getMessage('welcomeStep1BodyWithIcons')
  const source = raw || el.innerHTML

  const puzzleIconAlt = chrome.i18n.getMessage('welcomePuzzleIconAlt') || 'puzzle icon'
  const pinIconAlt = chrome.i18n.getMessage('welcomePinIconAlt') || 'pin icon'

  const tokenMap: Record<string, string> = {
    puzzleIcon: buildWelcomeInlineIconHtml(puzzleIconAlt, '../assets/puzzle.svg'),
    pinIcon: buildWelcomeInlineIconHtml(pinIconAlt, '../assets/pin.svg'),
    hamsaIcon: buildHamsaIconHtml()
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

const step: (HTMLElement | null)[] = [null]
step[1] = document.getElementById('step1')
step[2] = document.getElementById('step2')
step[3] = document.getElementById('step3')

const updateStep = (id: number, completed: boolean) => {
  if (completed) {
    step[id]?.classList.add('step-card-completed')
  } else {
    step[id]?.classList.remove('step-card-completed')
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

document.querySelector('#step3 .btn-secondary')
 ?.addEventListener('click', (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  updateStep(3, true)
})

document.querySelectorAll('.step-header').forEach((stepHeader, index) => {
  stepHeader.addEventListener('click', (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    updateStep(index + 1, false)
  })
})

applyStep1MessageTokens()
applyCompletedLabels()