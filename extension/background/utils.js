import { SETTINGS_KEY_PREFIX, ALL_DOMAINS } from '../common/settings.js';

export const getExemptions = (allSettings) => {
  const exemptions = {};
  for (const [[type, domain, settingId], value] of allSettings) {
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