export type BooleanStorageFlag = {
  get: () => Promise<boolean>
  set: (value?: boolean) => Promise<void>
  onChanged: (callback: (value: boolean) => void) => void
}

export function createBooleanStorageFlag (storageKey: string): BooleanStorageFlag {
  return {
    async get (): Promise<boolean> {
      const data = await chrome.storage.local.get(storageKey)
      return data[storageKey] === true
    },

    async set (value: boolean = true): Promise<void> {
      await chrome.storage.local.set({ [storageKey]: value })
    },

    onChanged (callback: (value: boolean) => void): void {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') {
          return
        }
        if (changes[storageKey] == null) {
          return
        }
        callback(changes[storageKey].newValue === true)
      })
    }
  }
}
