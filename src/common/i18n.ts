export const getLocalizedText = (key) => {
  const message = chrome.i18n.getMessage(key);
  console.log(`Getting localized text for key "${key}":`, message);
  if (!message) {
    console.warn(`No localized text found for key "${key}". Available keys:`, Object.keys(chrome.i18n.getAcceptLanguages ? {} : {}));
  }
  return message || key;
};
