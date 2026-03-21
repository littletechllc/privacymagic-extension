console.log('welcome.ts loaded');

const step1 = document.getElementById('step1')

const updateStep1 = (isOnToolbar: boolean) => {
  if (isOnToolbar) {
    step1?.classList.add('step-card-completed')
  } else {
    step1?.classList.remove('step-card-completed')
  }
}

chrome.action.onUserSettingsChanged.addListener(
  (details) => {
    console.log('User settings changed:', details);
    updateStep1(details.isOnToolbar ?? false)
  }
)

chrome.action.getUserSettings().then((userSettings) => {
  updateStep1(userSettings.isOnToolbar ?? false)
}).catch((error) => {
  console.error('Error getting user settings:', error)
})