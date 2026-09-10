import type { BrowserContext } from '@playwright/test'

/**
 * Pins the extension via chrome://extensions details ("Pin to toolbar").
 * This updates chrome.action user settings the same way a real user pin does.
 */
export const pinExtensionToToolbar = async (
  context: BrowserContext,
  extensionId: string
): Promise<void> => {
  const page = await context.newPage()
  try {
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
