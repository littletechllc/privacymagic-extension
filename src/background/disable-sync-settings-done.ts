import { logError } from '@src/common/util'
import { setDisableHistorySyncDone } from '@src/common/disable-history-sync-done-state'

const getWindowIdForTab = async (tabId: number): Promise<number> => {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId == null) {
      throw new Error('tab has no window id')
    }
    return tab.windowId
}

const isChromeSyncSettingsPage = (url: string | undefined): boolean => {
  if (url == null) return false
  return url.startsWith('chrome://settings/syncSetup')
}

const closeSidePanel = async (tabId: number): Promise<void> => {
  try {
    if (tabId != null) {
      await chrome.sidePanel.setOptions({ tabId, enabled: false })
      try {
        await chrome.sidePanel.close({ tabId })
      } catch (error) {
        logError(error, 'chrome.sidePanel.close failed after disabling panel for tab')
      }
      return
    }
  } catch (error) {
    logError(error, 'error closing side panel')
  }
}

const focusOrOpenWelcomeTab = async (windowId: number): Promise<void> => {
  const welcomeUrl = chrome.runtime.getURL('privacymagic/welcome.html')
  const tabs = await chrome.tabs.query({ url: welcomeUrl })
  const t = tabs.find((tab) => tab.windowId === windowId) ?? tabs[0]
  if (t?.id != null) {
    await chrome.windows.update(t.windowId, { focused: true })
    await chrome.tabs.update(t.id, { active: true })
    return
  }
  await chrome.tabs.create({ url: welcomeUrl, active: true, windowId })
}

/**
 * Persists welcome step disableHistorySync completion, closes the sync-help side panel, optionally removes the
 * Chrome sync settings tab, and focuses or opens the welcome page.
 */
export const disableSyncSettingsDone = async (tabId: number): Promise<void> => {
  await setDisableHistorySyncDone(true)
  const windowId = await getWindowIdForTab(tabId)
  await closeSidePanel(tabId)

  if (tabId != null) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (isChromeSyncSettingsPage(tab.url)) {
        await chrome.tabs.remove(tabId)
      }
    } catch (error) {
      logError(error, 'error removing settings tab after disable sync settings done')
    }
  }

  await focusOrOpenWelcomeTab(windowId)
}
