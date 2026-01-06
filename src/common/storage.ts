import { logError } from '../common/util'

export type KeyPath = string[]

const KEY_SEPARATOR = ':'

const keyPathToKey = (keyPath: KeyPath): string => {
  return keyPath.join(KEY_SEPARATOR)
}

export class StorageProxy {
  storage: chrome.storage.StorageArea

  constructor (storageType: 'local' | 'sync' | 'session' | 'managed') {
    this.storage = chrome.storage[storageType]
  }

  async set (keyPath: KeyPath, value: any): Promise<void> {
    const key = keyPathToKey(keyPath)
    return (await this.storage.set({ [key]: value }))
  }

  async get (keyPath: KeyPath): Promise<any> {
    const key = keyPathToKey(keyPath)
    return (await this.storage.get(key))[key]
  }

  async remove (keyPath: KeyPath): Promise<void> {
    const key = keyPathToKey(keyPath)
    return (await this.storage.remove(key))
  }

  async clear (): Promise<void> => {
    return (await this.storage.clear())
  }

  async getAll (): Promise<Array<[KeyPath, any]>> {
    const values = await this.storage.get()
    return Object.entries(values).map(([key, value]) => [key.split(KEY_SEPARATOR), value])
  }

  listenForChanges (keyPath: KeyPath, callback: (value: any) => void): void {
    this.storage.onChanged.addListener((changes) => {
      try {
        const key = keyPathToKey(keyPath)
        if (changes[key]) {
          callback(changes[key].newValue)
        }
      } catch (error) {
        logError(error, 'error responsding to storage changes', { keyPath, changes })
      }
    })
  }

  listenForAnyChanges (callback: (changes: Array<[KeyPath, any]>) => void): void {
    this.storage.onChanged.addListener(async (change) => {
      try {
        await callback(Object.entries(change).map(
          ([key, value]) => [key.split(KEY_SEPARATOR), value.newValue]))
      } catch (error) {
        logError(error, 'error responding to any storage changes', change)
      }
    })
  }
}

let storageLocal: StorageProxy | null = null
let storageSession: StorageProxy | null = null
let storageSync: StorageProxy | null = null
let storageManaged: StorageProxy | null = null

export const storage = {
  get local () {
    if (storageLocal == null) {
      storageLocal = new StorageProxy('local')
    }
    return storageLocal
  },
  get sync () {
    if (storageSync == null) {
      storageSync = new StorageProxy('sync')
    }
    return storageSync
  },
  get session () {
    if (storageSession == null) {
      storageSession = new StorageProxy('session')
    }
    return storageSession
  },
  get managed () {
    if (storageManaged == null) {
      storageManaged = new StorageProxy('managed')
    }
    return storageManaged
  }
}
