import type { BrowserContext, Page, Worker } from '@playwright/test'
import { isEdgeE2EBrowser, type E2EBrowser } from '../channels'

type DeveloperPrivatePin = {
  developerPrivate?: {
    updateExtensionConfiguration?: (update: {
      extensionId: string
      pinnedToToolbar: boolean
    }) => Promise<void>
  }
}

/**
 * Edge's extensions page has no "Pin to toolbar" toggle. developerPrivate on
 * edge://extensions updates the same toolbar pin state a user pin does.
 */
const pinExtensionOnEdge = async (page: Page, extensionId: string): Promise<void> => {
  await page.goto('edge://extensions/')
  await page.waitForFunction(() => {
    const browser = chrome as unknown as DeveloperPrivatePin
    return typeof browser.developerPrivate?.updateExtensionConfiguration === 'function'
  }, undefined, { timeout: 15_000 })
  await page.evaluate(async (id: string) => {
    const browser = chrome as unknown as DeveloperPrivatePin
    const update = browser.developerPrivate?.updateExtensionConfiguration
    if (update == null) {
      throw new Error('developerPrivate.updateExtensionConfiguration is unavailable')
    }
    await update({ extensionId: id, pinnedToToolbar: true })
  }, extensionId)
}

const pinExtensionOnChrome = async (page: Page, extensionId: string): Promise<void> => {
  await page.goto(`chrome://extensions/?id=${extensionId}`)
  await page.waitForFunction(() => {
    const manager = document.querySelector('extensions-manager')
    const detail = manager?.shadowRoot?.querySelector('extensions-detail-view')
    const row = detail?.shadowRoot?.querySelector('extensions-toggle-row#pin-to-toolbar')
    return row?.shadowRoot?.querySelector('cr-toggle#crToggle') != null
  }, undefined, { timeout: 15_000 })

  const toggled = await page.evaluate(() => {
    const manager = document.querySelector('extensions-manager')
    const detail = manager?.shadowRoot?.querySelector('extensions-detail-view')
    const row = detail?.shadowRoot?.querySelector('extensions-toggle-row#pin-to-toolbar')
    const toggle = row?.shadowRoot?.querySelector('cr-toggle#crToggle') as HTMLElement | null
    if (toggle == null) {
      return false
    }
    toggle.click()
    return true
  })
  if (!toggled) {
    throw new Error('Pin to toolbar toggle not found on chrome://extensions details')
  }
}

/**
 * Pins the extension so chrome.action user settings report it on the toolbar,
 * the same way a real user pin does.
 */
export const pinExtensionToToolbar = async (
  context: BrowserContext,
  extensionId: string,
  e2eBrowser: E2EBrowser
): Promise<void> => {
  const page = await context.newPage()
  try {
    if (isEdgeE2EBrowser(e2eBrowser)) {
      await pinExtensionOnEdge(page, extensionId)
    } else {
      await pinExtensionOnChrome(page, extensionId)
    }

    // Ensure Chrome reports the extension as pinned before returning.
    const worker = context.serviceWorkers().find((w) => w.url().includes(extensionId))
    if (worker == null) {
      throw new Error(`Service worker for extension ${extensionId} not found`)
    }
    await worker.evaluate(async () => {
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        const settings = await chrome.action.getUserSettings()
        if (settings.isOnToolbar === true) {
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      throw new Error('Timed out waiting for chrome.action isOnToolbar after pin')
    })
  } finally {
    await page.close()
  }
}

/** Closes the first-run setup tab so it does not steal active-tab focus. */
export const closeSetupPages = async (context: BrowserContext): Promise<void> => {
  for (const page of context.pages()) {
    if (page.url().includes('privacymagic/setup.html')) {
      await page.close()
    }
  }
}

/**
 * Opens the action popup as an extension page for a specific tab.
 * Prefer this over chrome.action.openPopup() in Playwright: openPopup is
 * unreliable without a focused browser UI, and navigating to popup.html
 * would otherwise make the popup itself the active tab.
 */
export const openExtensionPopupForTab = async (
  context: BrowserContext,
  extensionId: string,
  tabId: number
): Promise<Page> => {
  const popup = await context.newPage()
  await popup.goto(
    `chrome-extension://${extensionId}/default_popup/popup.html?tabId=${tabId}`
  )
  await popup.waitForLoadState('domcontentloaded')
  return popup
}

/** Resolves the Chrome tab id for a page URL (exact match). */
export const tabIdForUrl = async (
  serviceWorker: Worker,
  url: string
): Promise<number> => {
  const tabId = await serviceWorker.evaluate(async (pageUrl: string) => {
    const tabs = await chrome.tabs.query({ url: pageUrl })
    const id = tabs[0]?.id
    if (id == null) {
      throw new Error(`No tab found for url ${pageUrl}`)
    }
    return id
  }, url)
  return tabId
}
