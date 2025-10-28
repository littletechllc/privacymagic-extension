import { setToolbarIcon } from '../common/toolbar-icon.js'
import { initializeDynamicRules, clearDynamicRules } from './rules-generator.js'
import { injectCssForCosmeticFilters } from './cosmetic-filter-manager.js';
import { THEME_CONFIG } from '../common/theme.js';
import { getAllSettings, ALL_DOMAINS, SETTINGS_KEY_PREFIX, getSettingsForProtectionType, listenForSettingsChanges } from '../common/settings.js';

const getExemptions = (allSettings) => {
  const exemptions = {};
  for (const [[type, domain, categoryId, settingId], value] of allSettings) {
    exemptions[settingId] ||= [];
    if (type === SETTINGS_KEY_PREFIX) {
      if (domain === ALL_DOMAINS) {
        exemptions[settingId] = ["<all_urls>"];
      } else if (exemptions[settingId].length === 0 || exemptions[settingId][0] !== "<all_urls>") {
        exemptions[settingId].push(`*://${domain}/*`);
        exemptions[settingId].push(`*://*.${domain}/*`);
      }
    }
  }
  return exemptions;
}

self.getExemptions = getExemptions;

let contentScriptsCreated = false;

const addContentScripts = async () => {
  const settings = await getAllSettings();
  const exemptions = getExemptions(settings);
  const rules = []
  rules.push({
    id: 'foreground',
    js: ['content_scripts/foreground.js'],
    matches: ['<all_urls>'],
  });
  for (const settingId of getSettingsForProtectionType('script')) {
    const excludeMatches = exemptions[settingId] || [];
    rules.push({
      id: `toplevel_${settingId}`,
      js: [`content_scripts/toplevel/${settingId}.js`],
      matches: ['<all_urls>'],
      excludeMatches,
    });
    rules.push({
      id: `sublevel_${settingId}`,
      js: [`content_scripts/sublevel/${settingId}.js`],
      matches: ['<all_urls>'],        
      // excludeMatches not used because cross-origin subframes aren't exempted
    });
  }
  const rules_full = rules.map(rule => ({
    ...rule,
    allFrames: true,
    matchOriginAsFallback: true,
    runAt: 'document_start',
    world: 'MAIN',
  }));
  if (!contentScriptsCreated) {
    await chrome.scripting.registerContentScripts(rules_full);
    contentScriptsCreated = true;
  } else {
    await chrome.scripting.updateContentScripts(rules_full);
  }
};

chrome.runtime.onInstalled.addListener(async function (details) {
  await setToolbarIcon(THEME_CONFIG.toolbarIcon)
  await clearDynamicRules();
  //await chrome.runtime.openOptionsPage()
  const t1 = performance.now();
  await initializeDynamicRules();
  const t2 = performance.now();
  console.log(`initializeDynamicRules took ${t2 - t1} milliseconds`);
  //const contentBlockingDefinitionsUrl = chrome.runtime.getURL('rules/content-blocking-definitions.json');
  const t4 = performance.now();
  //console.log(`fetchJson took ${t4 - t3} milliseconds`);
  injectCssForCosmeticFilters();
  const t5 = performance.now();
  console.log(`injectCssForCosmeticFilters took ${t5 - t4} milliseconds`);
  addContentScripts();
  const t6 = performance.now();
  console.log(`addContentScripts took ${t6 - t5} milliseconds`);
  listenForSettingsChanges(addContentScripts);
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);
});
