import { logError } from '@src/common/util'

export type KeyPath = string[]

const KEY_SEPARATOR = ':'

const keyPathToKey = (keyPath: KeyPath): string => {
  return keyPath.join(KEY_SEPARATOR)
}

export class StorageProxy {
  storageLocal: chrome.storage.StorageArea
  storageSession: chrome.storage.StorageArea

  constructor () {
    this.storageLocal = chrome.storage.local
    this.storageSession = chrome.storage.session
  }

  async startup (): Promise<void> {
    const items = await this.storageLocal.get()
    for (const [key, value] of Object.entries(items)) {
      await this.storageSession.set({ [key]: value })
    }
  }

  async set (keyPath: KeyPath, value: unknown): Promise<void> {
    const key = keyPathToKey(keyPath)
    void this.storageLocal.set({ [key]: value })
    await this.storageSession.set({ [key]: value })
  }

  async get (keyPath: KeyPath): Promise<undefined | boolean> {
    const key = keyPathToKey(keyPath)
    return (await this.storageSession.get(key))[key] as undefined | boolean
  }

  async remove (keyPath: KeyPath): Promise<void> {
    const key = keyPathToKey(keyPath)
    void this.storageLocal.remove(key)
    await this.storageSession.remove(key)
  }

  async clear (): Promise<void> {
    void this.storageLocal.clear()
    await this.storageSession.clear()
  }

  async getAll (): Promise<Array<[KeyPath, unknown]>> {
    const values = await this.storageSession.get()
    return Object.entries(values).map(([key, value]) => [key.split(KEY_SEPARATOR), value])
  }

  listenForChanges (keyPath: KeyPath, callback: (value: boolean | undefined) => void): void {
    this.storageSession.onChanged.addListener((changes) => {
      try {
        const key = keyPathToKey(keyPath)
        if (changes[key] !== undefined) {
          window.setTimeout(() => {
            callback(changes[key].newValue as boolean | undefined)
          }, 0)
        }
      } catch (error) {
        logError(error, 'error responding to storage changes', { keyPath, changes })
      }
    })
  }

  listenForAnyChanges (callback: (changes: Array<[KeyPath, unknown]>) => void): void {
    this.storageSession.onChanged.addListener((change) => {
      try {
        window.setTimeout(() => {
          callback(Object.entries(change).map(
          ([key, value]) => [key.split(KEY_SEPARATOR), value.newValue]))
        }, 0)
      } catch (error) {
        logError(error, 'error responding to any storage changes', change)
      }
    })
  }
}


export const storage = new StorageProxy()
