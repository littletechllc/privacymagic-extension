export const getLocalizedText = (key: string): string => {
  const message = chrome.i18n.getMessage(key)
  console.log(`Getting localized text for key "${key}":`, message)
  if (message === '') {
    console.warn(`No localized text found for key "${key}"`)
  }
  return message !== '' ? message : key
}
