/* global chrome */

(() => {
  const DATA_SECRET_ATTRIBUTE = "data-privacy-magic-secret";
  const sharedSecret = (() => {
    const documentElement = document.documentElement;
    const existingSecret = documentElement.getAttribute(DATA_SECRET_ATTRIBUTE);
    if (existingSecret !== null) {
      documentElement.removeAttribute(DATA_SECRET_ATTRIBUTE);
      return existingSecret;
    } else {
      let newSecret;
      try {
        newSecret = crypto.randomUUID();
      } catch (error) {
        newSecret = Math.random().toString(16).substring(2);
      }
      documentElement.setAttribute(DATA_SECRET_ATTRIBUTE, newSecret);
      return newSecret;
    }
  })();
  console.log('isolated.js loaded with secret:', sharedSecret);
  (async () => {
    console.log('waiting for getDisabledSettings response');
    /*const { disabledSettings } */const result = await chrome.runtime.sendMessage(
      { type: 'getDisabledSettings' });
    console.log('result:', result);
    const disabledSettings = result.disabledSettings;
    console.log('getDisabledSettings response received', disabledSettings);
    // Use a null-prototype object for the detail to avoid monkey patching.
    const detail = Object.create(null);
    detail.type = 'getDisabledSettingsResponse';
    detail.disabledSettings = disabledSettings;
    document.documentElement.dispatchEvent(new CustomEvent(`message-${sharedSecret}`, { detail }));
  })();
})();
