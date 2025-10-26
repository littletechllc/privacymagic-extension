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

export const getSetting = async (domain, categoryId, settingId, defaultValue) => {
  const keyPath = ["_SETTINGS_", domain, categoryId, settingId];
  const result = await storage.local.get(keyPath);
  return result === undefined ? defaultValue : result;
};

export const ALL_DOMAINS = '_ALL_DOMAINS_';

// TODO: Create settings functions: get, set, listenForChanges

export const resetAllSettingsToDefaults = async (domain) => {
  const items = await storage.local.getAll();
  for (const [keyPath, value] of items) {
    if (keyPath[0] === '_SETTINGS_' && keyPath[1] === domain) {
      await storage.local.remove(keyPath);
    }
  }
};