const KEY_SEPARATOR = ':'

const keyPathToKey = (keyPath) => {
  return keyPath.join(KEY_SEPARATOR)
}

export const setStorage = async (keyPath, value) => {
  const key = keyPathToKey(keyPath)
  return chrome.storage.local.set({ [key]: value });
};

export const getStorage = async (keyPath) => {
  const key = keyPathToKey(keyPath)
  return (await chrome.storage.local.get(key))[key];
};

export const getAllStorage = async () => {
  const values = await chrome.storage.local.get();
  return Object.entries(values).map(([key, value]) => [key.split(KEY_SEPARATOR), value]);
};

export const listenForStorageChanges = async (keyPath, callback) => {
  return chrome.storage.local.onChanged.addListener((changes) => {
    const key = keyPathToKey(keyPath)
    if (changes[key]) {
      callback(changes[key].newValue);
    }
  });
};