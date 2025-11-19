import { storage } from './storage.js';

export const PRIVACY_SETTINGS_CONFIG = {
  ads: {
    category: 'blocking'
  },
  battery: {
    category: 'fingerprinting'
  },
  screen: {
    category: 'fingerprinting'
  },
  useragent: {
    category: 'fingerprinting'
  },
  windowName: {
    category: 'navigation'
  },
  keyboard: {
    category: 'fingerprinting'
  },
  timer: {
    category: 'fingerprinting'
  },
  gpu: {
    category: 'fingerprinting'
  },
  display: {
    category: 'fingerprinting'
  },
  memory: {
    category: 'fingerprinting'
  },
  network: {
    category: 'fingerprinting'
  },
  device: {
    category: 'fingerprinting'
  },
  cpu: {
    category: 'fingerprinting'
  },
  /*
  audio: {
    category: 'fingerprinting'
  },
  browser: {
    category: 'fingerprinting'
  },
  disk: {
    category: 'fingerprinting'
  },
  fonts: {
    category: 'fingerprinting'
  },
  language: {
    category: 'fingerprinting'
  },
  math: {
    category: 'fingerprinting'
  },
  timezone: {
    category: 'fingerprinting'
  },
  touch: {
    category: 'fingerprinting'
  }, */
  queryParameters: {
    category: 'navigation'
  },
  referrerPolicy: {
    category: 'navigation'
  },
  gpc: {
    category: 'navigation'
  },
  serviceWorker: {
    category: 'leakyFeatures'
  },
  sharedStorage: {
    category: 'leakyFeatures'
  },
  worker: {
    category: 'leakyFeatures'
  },
  iframe: {
    category: 'leakyFeatures'
  }
};

export const ALL_DOMAINS = '_ALL_DOMAINS_';
export const SETTINGS_KEY_PREFIX = '_SETTINGS_';

export const getSetting = async (domain, settingId) => {
  const defaultSetting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId]);
  // If a setting has been set to false for the default settings,
  // then it overrides the domain-specific setting and we return
  // false regardless of the domain-specific value.
  if (defaultSetting === false) {
    return false;
  }
  const domainSpecificSetting = await storage.local.get(
    [SETTINGS_KEY_PREFIX, domain, settingId]
  );
  // If a domain-specific setting has been set to false, then we
  // return false.
  if (domainSpecificSetting === false) {
    return false;
  }
  // If a setting hasn't been set for either the default or
  // domain-specific settings, then we assume it's enabled.
  return true;
};

export const setSetting = async (domain, settingId, value) => {
  if (value !== true && value !== false) {
    throw new Error(`Invalid setting value: ${value}`);
  }
  // If the domain is the default domain, then we set the setting value.
  // We remove the setting if the value is being set to true, since
  // the default value is true.
  if (domain === ALL_DOMAINS) {
    if (value === true) {
      await storage.local.remove([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId]);
    } else {
      await storage.local.set([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId], false);
    }
    return;
  }
  // If the setting value is the same as the default value, then we remove the domain-specific setting.
  const defaultSetting = await storage.local.get([SETTINGS_KEY_PREFIX, ALL_DOMAINS, settingId]);
  if (defaultSetting === value) {
    await storage.local.remove([SETTINGS_KEY_PREFIX, domain, settingId]);
    return;
  }
  // Otherwise, we set the domain-specific setting value.
  await storage.local.set([SETTINGS_KEY_PREFIX, domain, settingId], value);
};

export const getAllSettings = async () => {
  const storedSettings = await storage.local.getAll();
  const allSettings = [];
  for (const [[type, domain, settingId], value] of storedSettings) {
    if (type === SETTINGS_KEY_PREFIX && settingId in PRIVACY_SETTINGS_CONFIG) {
      allSettings.push([domain, settingId, value]);
    }
  }
  return allSettings;
};

export const listenForSettingsChanges = (callback) => {
  storage.local.listenForAnyChanges(async (changes) => {
    const settingsChanges = changes.filter(([keypath, value]) => keypath[0] === SETTINGS_KEY_PREFIX)
      .map(([keyPath, value]) => [keyPath, value === undefined ? true : value]);
    await callback(settingsChanges);
  });
};

export const resetAllSettingsToDefaults = async (domain) => {
  const items = await storage.local.getAll();
  for (const [keyPath] of items) {
    if (keyPath[0] === '_SETTINGS_' && keyPath[1] === domain) {
      await storage.local.remove(keyPath);
    }
  }
};
