import { generateIcon } from './icon-generator.js'
import { initializeDynamicRules } from './rules-generator.js'
import { setChromePrivacyPrefs } from './chrome-privacy-prefs.js'

const fetchJson = async (url) => {
  const response = await fetch(url);
  return response.json();
}

generateIcon()

chrome.runtime.onInstalled.addListener(async function (details) {
  chrome.runtime.openOptionsPage()
  await initializeDynamicRules()
  await setChromePrivacyPrefs()
  const contentBlockingDefinitionsUrl = chrome.runtime.getURL('rules/content-blocking-definitions.json');
  const contentBlockingDefinitions = await fetchJson(contentBlockingDefinitionsUrl);
  console.log(contentBlockingDefinitions.length);
  await chrome.scripting.registerContentScripts(contentBlockingDefinitions)
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
});
