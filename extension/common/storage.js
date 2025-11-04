/* global chrome */

const KEY_SEPARATOR = ':';

const keyPathToKey = (keyPath) => {
  return keyPath.join(KEY_SEPARATOR);
};

class StorageProxy {
  constructor (storageType) {
    this.storage = chrome.storage[storageType];
  }

  async set (keyPath, value) {
    const key = keyPathToKey(keyPath);
    return (await this.storage.set({ [key]: value }));
  }

  async get (keyPath) {
    const key = keyPathToKey(keyPath);
    return (await this.storage.get(key))[key];
  }

  async remove (keyPath) {
    const key = keyPathToKey(keyPath);
    return (await this.storage.remove(key));
  }

  async clear () {
    return (await this.storage.clear());
  }

  async getAll () {
    const values = await this.storage.get();
    return Object.entries(values).map(([key, value]) => [key.split(KEY_SEPARATOR), value]);
  }

  listenForChanges (keyPath, callback) {
    this.storage.onChanged.addListener((changes) => {
      try {
        const key = keyPathToKey(keyPath);
        if (changes[key]) {
          callback(changes[key].newValue);
        }
      } catch (error) {
        console.error('error responsding to storage changes', keyPath, changes, error);
      }
    });
  }

  listenForAnyChanges (callback) {
    this.storage.onChanged.addListener(async (change) => {
      try {
        await callback(Object.entries(change).map(
          ([key, value]) => [key.split(KEY_SEPARATOR), value.newValue]));
      } catch (error) {
        console.error('error responding to any storage changes', change, error);
      }
    });
  }
}

let storageLocal_, storageSession_, storageSync_, storageManaged_;

export const storage = {
  get local () {
    if (!storageLocal_) {
      storageLocal_ = new StorageProxy('local');
    }
    return storageLocal_;
  },
  get sync () {
    if (!storageSync_) {
      storageSync_ = new StorageProxy('sync');
    }
    return storageSync_;
  },
  get session () {
    if (!storageSession_) {
      storageSession_ = new StorageProxy('session');
    }
    return storageSession_;
  },
  get managed () {
    if (!storageManaged_) {
      storageManaged_ = new StorageProxy('managed');
    }
    return storageManaged_;
  }
};
