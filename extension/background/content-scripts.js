/* global chrome */

import { PRIVACY_SETTINGS_CONFIG, getAllSettings } from '../common/settings.js';

const initRuleOptions = {
  matchOriginAsFallback: true,
  persistAcrossSessions: false,
  runAt: 'document_start',
  allFrames: true
};

const logRules = async () => {
  const rules = await chrome.scripting.getRegisteredContentScripts({});
  console.log('rules:', rules);
};

export const updateContentScripts = async (domain, settingId, value) => {
  const rules = await chrome.scripting.getRegisteredContentScripts({});
  const enabledRule = rules.find(rule => rule.id === `enable_${settingId}`);
  const disabledRule = rules.find(rule => rule.id === `disable_${settingId}`);
  if (!enabledRule || !disabledRule) {
    return;
  }
  const matchStrings = [`*://${domain}/*`, `*://*.${domain}/*`];
  const excludeMatches = enabledRule.excludeMatches || [];
  const matches = disabledRule.matches || [];
  if (value === false) {
    // Protection is disabled, so we exclude from enabled and add to disabled.
    enabledRule.excludeMatches = [...excludeMatches, ...matchStrings];
    disabledRule.matches = [...matches, ...matchStrings];
  } else {
    // Protection is enabled, so we remove the exclusions from enabled
    // and add the matches from disabled.
    enabledRule.excludeMatches = excludeMatches.filter(match => !matchStrings.includes(match));
    disabledRule.matches = matches.filter(match => !matchStrings.includes(match));
  }
  console.log('enabledRule:', enabledRule);
  console.log('disabledRule:', disabledRule);
  await chrome.scripting.updateContentScripts([enabledRule, disabledRule]);
  await logRules();
};

const initializeContentScripts = async () => {
  const rulesById = {};
  const rules = await chrome.scripting.getRegisteredContentScripts({});
  for (const rule of rules) {
    if (rule.id.startsWith('enable_') || rule.id.startsWith('disable_')) {
      rule.excludeMatches ||= [];
      rule.matches ||= [];
      rulesById[rule.id] = rule;
    }
  }
  const allSettings = await getAllSettings();
  for (const [domain, settingId, value] of allSettings) {
    const matchStrings = [`*://${domain}/*`, `*://*.${domain}/*`];
    if (PRIVACY_SETTINGS_CONFIG[settingId] &&
        PRIVACY_SETTINGS_CONFIG[settingId].script && value === false) {
      rulesById[`enable_${settingId}`].excludeMatches.push(...matchStrings);
      rulesById[`disable_${settingId}`].matches.push(...matchStrings);
    }
  }
  await chrome.scripting.updateContentScripts(Object.values(rulesById));
  await logRules();
};

export const setupContentScripts = async () => {
  const allRules = [];
  allRules.push({
    ...initRuleOptions,
    id: 'foreground',
    js: ['content_scripts/foreground.js'],
    matches: ['<all_urls>'],
    world: 'MAIN'
  });
  allRules.push({
    ...initRuleOptions,
    id: 'isolated',
    js: ['content_scripts/isolated.js'],
    matches: ['<all_urls>'],
    world: 'ISOLATED'
  });
  for (const [settingId, settingConfig] of Object.entries(PRIVACY_SETTINGS_CONFIG)) {
    if (settingConfig.script) {
      allRules.push({
        ...initRuleOptions,
        id: `enable_${settingId}`,
        js: [`content_scripts/enable/${settingId}.js`],
        matches: ['<all_urls>'],
        world: 'MAIN'
      }, {
        ...initRuleOptions,
        id: `disable_${settingId}`,
        js: [`content_scripts/disable/${settingId}.js`],
        matches: ['*://dummy/*'],
        world: 'MAIN'
      });
    }
  }
  await chrome.scripting.registerContentScripts(allRules);
  await initializeContentScripts();
};
