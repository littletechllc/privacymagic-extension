const initRuleOptions = {
  allFrames: true,
  matchOriginAsFallback: true,
  runAt: 'document_start',
  world: 'MAIN',
}

const foregroundRule = {
  id: 'foreground',
  js: ['content_scripts/foreground.js'],
  matches: ['<all_urls>'],
  ...initRuleOptions,
};

const toplevelRule = (settingId) => ({
  id: `toplevel_${settingId}`,
  js: [`content_scripts/toplevel/${settingId}.js`],
  matches: ['<all_urls>'],
  excludeMatches: [],
  ...initRuleOptions,
});

const sublevelRule = (settingId) => ({
  id: `sublevel_${settingId}`,
  js: [`content_scripts/sublevel/${settingId}.js`],
  matches: ['<all_urls>'],        
  // excludeMatches not used because cross-origin subframes aren't exempted
  ...initRuleOptions,
});

export const updateContentScripts = async (domain, settingId, value) => {
  const currentToplevelRules = await chrome.scripting.getRegisteredContentScripts({
    ids: [toplevelRule(settingId).id],
  });
  const currentToplevelRule = currentToplevelRules[0];
  if (!currentToplevelRule) {
    return;
  }
  const matchStrings = [`*://${domain}/*`, `*://*.${domain}/*`];
  const excludeMatches = currentToplevelRule.excludeMatches || [];
  if (value === false) {
    // Protection is disabled, so we add the matches to the exclude matches.
    currentToplevelRule.excludeMatches = [...excludeMatches, ...matchStrings];
  } else {
    currentToplevelRule.excludeMatches = excludeMatches.filter(match => !matchStrings.includes(match));
  }
  const rules = [
    foregroundRule,
    currentToplevelRule,
    sublevelRule(settingId),
  ];
  await chrome.scripting.updateContentScripts(rules);
  const totalContentRules =await chrome.scripting.getRegisteredContentScripts();
}

export const createContentScripts = async (settingId) => {
  const rules = [
    foregroundRule,
    toplevelRule(settingId),
    sublevelRule(settingId),
  ];
  await chrome.scripting.registerContentScripts(rules);
}