import { storage } from './storage.js';

export const PRIVACY_SETTINGS_CONFIG = {
  blocking: {
    ads: {
      dnr: true,
      script: true
    }
  },
  connections: {
    client_hints: {
      dnr: true
    },
    headers: {
      dnr: true
    },
    query_parameters: {
      dnr: true
    },
  },
  fingerprinting: {
    do_not_track: {
      script: true,
      dnr: true,
    },
    hardware: {
      script: true
    },
    screen: {
      script: true
    },
    window_name: {
      script: true
    },
  }
};

export const ALL_DOMAINS = '_ALL_DOMAINS_';
export const SETTINGS_KEY_PREFIX = "_SETTINGS_";

export const getSetting = async (domain, categoryId, settingId) => {
  const default_setting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, categoryId, settingId]);
  if (default_setting === false) {
    return false;
  }
  const domain_specific_setting = await storage.local.get(
    [SETTINGS_KEY_PREFIX, domain, categoryId, settingId]
  );
  if (domain_specific_setting === false) {
    return false;
  }
  return true;
};

export const setSetting = async (domain, categoryId, settingId, value) => {
  if (domain === ALL_DOMAINS) {
    await storage.local.set([SETTINGS_KEY_PREFIX, ALL_DOMAINS, categoryId, settingId], value);
    return;
  }
  const default_setting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, categoryId, settingId]);
  if (default_setting === value) {
    await storage.local.remove([SETTINGS_KEY_PREFIX, domain, categoryId, settingId]);
    return;
  }
  await storage.local.set([SETTINGS_KEY_PREFIX, domain, categoryId, settingId], value);
};

// TODO: Create settings functions: get, set, listenForChanges

export const resetAllSettingsToDefaults = async (domain) => {
  const items = await storage.local.getAll();
  for (const [keyPath, value] of items) {
    if (keyPath[0] === '_SETTINGS_' && keyPath[1] === domain) {
      await storage.local.remove(keyPath);
    }
  }
};