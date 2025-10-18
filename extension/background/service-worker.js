import './service-worker-utils.js'
import { contentBlockingDefinitions } from './content-blocking-definitions.js'
import { generateIcon } from './icon-generator.js'
import { initializeDynamicRules } from './rules-generator.js'
import { setChromePrivacyPrefs } from './chrome-privacy-prefs.js'

generateIcon()

chrome.runtime.onInstalled.addListener(async function (details) {
  chrome.runtime.openOptionsPage()
  await initializeDynamicRules()
  await setChromePrivacyPrefs()
  await chrome.scripting.registerContentScripts(contentBlockingDefinitions)
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
});
