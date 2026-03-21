console.log('welcome.ts loaded');

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