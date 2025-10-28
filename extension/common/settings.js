import { storage } from './storage.js';

export const PRIVACY_SETTINGS_CONFIG = {
  blocking: {
    ads: {
      dnr: true,
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
    gpc: {
      script: true,
      headers: true
    }
  },
  fingerprinting: {
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
  // If a setting has been set to false for the default settings,
  // then it overrides the domain-specific setting and we return
  // false regardless of the domain-specific value.
  if (default_setting === false) {
    return false;
  }
  const domain_specific_setting = await storage.local.get(
    [SETTINGS_KEY_PREFIX, domain, categoryId, settingId]
  );
  // If a domain-specific setting has been set to false, then we
  // return false.
  if (domain_specific_setting === false) {
    return false;
  }
  // If a setting hasn't been set for either the default or
  // domain-specific settings, then we assume it's enabled.
  return true;
};

export const setSetting = async (domain, categoryId, settingId, value) => {
  if (value !== true && value !== false) {
    throw new Error(`Invalid setting value: ${value}`);
  }
  // If the domain is the default domain, then we set the setting value.
  // We remove the setting if the value is being set to true, since
  // the default value is true.
  if (domain === ALL_DOMAINS) {
    if (value === true) {
      await storage.local.remove([SETTINGS_KEY_PREFIX, ALL_DOMAINS, categoryId, settingId]);
    } else {
      await storage.local.set([SETTINGS_KEY_PREFIX, ALL_DOMAINS, categoryId, settingId], false);
    }
    return;
  }
  // If the setting value is the same as the default value, then we remove the domain-specific setting.
  const default_setting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, categoryId, settingId]);
  if (default_setting === value) {
    await storage.local.remove([SETTINGS_KEY_PREFIX, domain, categoryId, settingId]);
    return;
  }
  // Otherwise, we set the domain-specific setting value.
  await storage.local.set([SETTINGS_KEY_PREFIX, domain, categoryId, settingId], value);
};

export const getAllSettings = async () => {
  const settings = await storage.local.getAll();
  return settings;
};

export const getSettingsForProtectionType = (protection_type) => {
  const settings = [];
  for (const [categoryId, categoryConfig] of Object.entries(PRIVACY_SETTINGS_CONFIG)) {
    for (const [settingId, settingConfig] of Object.entries(categoryConfig)) {
      if (settingConfig[protection_type]) {
        settings.push(settingId);
      }
    }
  }
  return settings;
}

export const listenForSettingsChanges = (callback) => {
  storage.local.listenForAnyChanges((changes) => {
    const settingsChanges = changes.filter(([keypath, value]) => keypath[0] === SETTINGS_KEY_PREFIX)
           .map(([keyPath, value]) => [keyPath, value === undefined ? true : value]);
    callback(settingsChanges);
  });
}

export const resetAllSettingsToDefaults = async (domain) => {
  const items = await storage.local.getAll();
  for (const [keyPath, value] of items) {
    if (keyPath[0] === '_SETTINGS_' && keyPath[1] === domain) {
      await storage.local.remove(keyPath);
    }
  }
};