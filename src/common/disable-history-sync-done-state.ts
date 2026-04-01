const DISABLE_HISTORY_SYNC_DONE_KEY = 'welcomeHistorySyncStepCompleted'

export const setDisableHistorySyncDone = async (done: boolean = true): Promise<void> => {
  await chrome.storage.local.set({ [DISABLE_HISTORY_SYNC_DONE_KEY]: done })
}

export const getDisableHistorySyncDone = async (): Promise<boolean> => {
  const data = await chrome.storage.local.get(DISABLE_HISTORY_SYNC_DONE_KEY)
  return data[DISABLE_HISTORY_SYNC_DONE_KEY] === true
}

export function onDisableHistorySyncDoneChanged (callback: (done: boolean) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return
    }
    if (changes[DISABLE_HISTORY_SYNC_DONE_KEY] == null) {
      return
    }
    callback(changes[DISABLE_HISTORY_SYNC_DONE_KEY].newValue === true)
  })
}
