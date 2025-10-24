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

export const resetAllSettingsToDefaults = async (domain) => {
  const items = await storage.local.getAll();
  for (const [keyPath, value] of items) {
    if (keyPath[0] === '_SETTINGS_' && keyPath[1] === domain) {
      await storage.local.remove(keyPath);
    }
  }
};