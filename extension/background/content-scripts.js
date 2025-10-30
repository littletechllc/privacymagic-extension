/* global chrome */

import { PRIVACY_SETTINGS_CONFIG } from '../common/settings.js';

const initRuleOptions = {
  allFrames: true,
  matchOriginAsFallback: true,
  persistAcrossSessions: false,
  runAt: 'document_start',
  world: 'MAIN'
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
    // Protection is disabled, so we add the matches to the exclusion list.
    enabledRule.excludeMatches = [...excludeMatches, ...matchStrings];
    disabledRule.matches = [...matches, ...matchStrings];
  } else {
    // Protection is enabled, so we remove the matches from the exclusion list.
    enabledRule.excludeMatches = excludeMatches.filter(match => !matchStrings.includes(match));
    disabledRule.matches = matches.filter(match => !matchStrings.includes(match));
  }
  console.log('enabledRule:', enabledRule);
  console.log('disabledRule:', disabledRule);
  await chrome.scripting.updateContentScripts([enabledRule, disabledRule]);
  await logRules();
};

export const setupContentScripts = async () => {
  const currentRules = await chrome.scripting.getRegisteredContentScripts({});
  await chrome.scripting.unregisterContentScripts({ids: currentRules.map(rule => rule.id)});
  const allRules = [];
  allRules.push({
    id: 'foreground',
    js: ['content_scripts/foreground.js'],
    matches: ['<all_urls>'],
    ...initRuleOptions
  });
  for (const [settingId, settingConfig] of Object.entries(PRIVACY_SETTINGS_CONFIG)) {
    if (settingConfig.script) {
      allRules.push({
        id: `enable_${settingId}`,
        js: [`content_scripts/enable/${settingId}.js`],
        matches: ['<all_urls>'],
        excludeMatches: [],
        ...initRuleOptions
      }, {
        id: `disable_${settingId}`,
        js: [`content_scripts/disable/${settingId}.js`],
        matches: ['*://dummy/*'],
        ...initRuleOptions
      });
    }
  }
  await chrome.scripting.registerContentScripts(allRules);
  await logRules();
};
