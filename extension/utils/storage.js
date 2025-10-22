const KEY_SEPARATOR = ':'

const keyPathToKey = (keyPath) => {
  return keyPath.join(KEY_SEPARATOR)
}

class StorageProxy {
  constructor(storageType) {
    this.storage = chrome.storage[storageType]
  }

  async set(keyPath, value) {
    const key = keyPathToKey(keyPath)
    return this.storage.set({ [key]: value });
  };

  async get(keyPath) {
    const key = keyPathToKey(keyPath)
    return (await this.storage.get(key))[key];
  };

  async remove(keyPath) {
    const key = keyPathToKey(keyPath)
    return this.storage.remove(key);
  };

  async clear() {
    return this.storage.clear();
  };

  async getAll() {
    const values = await this.storage.get();
    return Object.entries(values).map(([key, value]) => [key.split(KEY_SEPARATOR), value]);
  };

  async listenForChanges(keyPath, callback) {
    this.storage.onChanged.addListener((changes) => {
      const key = keyPathToKey(keyPath)
      if (changes[key]) {
        callback(changes[key].newValue);
      }
    });
  };

}

let storageLocal_, storageSession_, storageSync_, storageManaged_

export const storage = {
  get local() {
    if (!storageLocal_) {
      storageLocal_ = new StorageProxy('local')
    }
    return storageLocal_
  },
  get sync() {
    if (!storageSync_) {
      storageSync_ = new StorageProxy('sync')
    }
    return storageSync_
  },
  get session() {
    if (!storageSession_) {
      storageSession_ = new StorageProxy('session')
    }
    return storageSession_
  },
  get managed() {
    if (!storageManaged_) {
      storageManaged_ = new StorageProxy('managed')
    }
    return storageManaged_
  }
}