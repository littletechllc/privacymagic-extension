import { SETTINGS_KEY_PREFIX, ALL_DOMAINS, getAllSettings, getSettingsForProtectionType, listenForSettingsChanges } from '../common/settings.js';

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

export const setupContentScripts = () => {
  addContentScripts();
  listenForSettingsChanges(addContentScripts);
}