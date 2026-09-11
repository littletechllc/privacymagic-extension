import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { pinExtensionToToolbar } from './helpers/chrome-extensions'

const isSetupPage = (url: string): boolean =>
  url.includes('privacymagic/setup.html')

const waitForSetupPage = async (context: BrowserContext): Promise<Page> => {
  const existing = context.pages().find((page) => isSetupPage(page.url()))
  const setupPage = existing ?? await context.waitForEvent('page', {
    predicate: (page) => isSetupPage(page.url()),
    timeout: 30_000
  })
  await setupPage.waitForLoadState('domcontentloaded')
  return setupPage
}

const openSyncHelpSidePanel = async (
  context: BrowserContext,
  extensionId: string,
  setupPage: Page
): Promise<Page> => {
  const sidePanelPromise = context.waitForEvent('page', {
    predicate: (page) =>
      page.url().includes(`${extensionId}/privacymagic/sidepanel-sync-help.html`),
    timeout: 30_000
  })
  await setupPage.locator('#step_disableHistorySync .btn-primary').click()
  const sidePanel = await sidePanelPromise
  await sidePanel.waitForLoadState('domcontentloaded')
  return sidePanel
}

/** Settings URLs the sync-help flow may open (history-sync phase or Google-services fallback). */
const isHistorySyncSettingsUrl = (url: string): boolean =>
  url.startsWith('chrome://settings/account') ||
  url.startsWith('chrome://settings/syncSetup/advanced')

const isGoogleServicesSettingsUrl = (url: string): boolean =>
  url.startsWith('chrome://settings/googleServices') ||
  // Legacy fallback when googleServices is unavailable (optional text fragment).
  (url.startsWith('chrome://settings/syncSetup') && !url.includes('/advanced'))

test.describe('first install', () => {
  test('opens the setup page after the extension is installed', async ({ context }) => {
    const setupPage = await waitForSetupPage(context)

    await expect(setupPage).toHaveTitle('Privacy Magic Setup')
    await expect(setupPage.locator('h1.setup-msg')).toHaveText('Welcome to Privacy Magic!')

    const cards = setupPage.locator('.step-card')
    await expect(cards).toHaveCount(3)
    for (const card of await cards.all()) {
      await expect(card).not.toHaveClass(/step-card-completed/)
      await expect(card).not.toHaveClass(/step-card-collapsed/)
    }
  })

  test('completes the pin step when the extension is pinned to the toolbar', async ({
    context,
    extensionId
  }) => {
    const setupPage = await waitForSetupPage(context)
    const pinCard = setupPage.locator('#step_pin')
    await expect(pinCard).not.toHaveClass(/step-card-completed/)
    await expect(pinCard).not.toHaveClass(/step-card-collapsed/)

    await pinExtensionToToolbar(context, extensionId)

    await expect(pinCard).toHaveClass(/step-card-completed/)
    await expect(pinCard).toHaveClass(/step-card-collapsed/)
    // Other steps stay incomplete/open.
    await expect(setupPage.locator('#step_vpn')).not.toHaveClass(/step-card-completed/)
    await expect(setupPage.locator('#step_disableHistorySync')).not.toHaveClass(/step-card-completed/)
  })

  test('completes the VPN step when "I\'ve got a VPN!" is clicked', async ({ context }) => {
    const setupPage = await waitForSetupPage(context)
    const vpnCard = setupPage.locator('#step_vpn')
    await expect(vpnCard).not.toHaveClass(/step-card-completed/)
    await expect(vpnCard).not.toHaveClass(/step-card-collapsed/)

    await setupPage.locator('#step_vpn .btn-secondary').click()

    await expect(vpnCard).toHaveClass(/step-card-completed/)
    await expect(vpnCard).toHaveClass(/step-card-collapsed/)
    await expect(setupPage.locator('#step_pin')).not.toHaveClass(/step-card-completed/)
    await expect(setupPage.locator('#step_disableHistorySync')).not.toHaveClass(/step-card-completed/)
  })

  test('opens sync-help side panel when "Yes, show me" is clicked', async ({ context, extensionId }) => {
    const setupPage = await waitForSetupPage(context)
    const historyCard = setupPage.locator('#step_disableHistorySync')
    await expect(historyCard).not.toHaveClass(/step-card-completed/)

    const sidePanel = await openSyncHelpSidePanel(context, extensionId, setupPage)
    await expect(sidePanel).toHaveURL(/sidepanel-sync-help\.html\?tabId=\d+/)
    await expect(sidePanel.locator('#syncHelpOpenSettingsBtn')).toBeVisible()
    await expect(sidePanel.locator('#syncHelpPhasePending')).toBeVisible()

    await expect(historyCard).toHaveClass(/step-card-completed/)
    await expect(historyCard).toHaveClass(/step-card-collapsed/)
  })

  test('Open settings advances the side panel and opens a Chrome settings page', async ({
    context,
    extensionId
  }) => {
    const setupPage = await waitForSetupPage(context)
    const sidePanel = await openSyncHelpSidePanel(context, extensionId, setupPage)
    await expect(sidePanel.locator('#syncHelpPhasePending')).toBeVisible()

    await sidePanel.locator('#syncHelpOpenSettingsBtn').click()

    await expect(sidePanel.locator('#syncHelpPhasePending')).toBeHidden({ timeout: 15_000 })

    const ready = sidePanel.locator('#syncHelpPhaseReady')
    const googleServices = sidePanel.locator('#syncHelpPhaseGoogleServices')
    await expect.poll(async () => {
      return (await ready.isVisible()) || (await googleServices.isVisible())
    }, { timeout: 15_000 }).toBe(true)

    let settingsPage: Page | undefined
    await expect.poll(() => {
      settingsPage = context.pages().find((page) => {
        const url = page.url()
        return isHistorySyncSettingsUrl(url) || isGoogleServicesSettingsUrl(url)
      })
      return settingsPage != null
    }, { timeout: 15_000 }).toBe(true)

    expect(settingsPage).toBeDefined()

    if (await ready.isVisible()) {
      // Signed-in / history-sync settings available → phase 1 of 2.
      expect(isHistorySyncSettingsUrl(settingsPage!.url())).toBe(true)
      await expect(sidePanel.locator('#syncHelpHeadingProgress')).toHaveText(' (1/2)')
      await expect(sidePanel.locator('.sync-help-continue-btn').first()).toBeVisible()
    } else {
      // Fresh unsigned profile: account/syncSetup bounce → Google services fallback.
      expect(isGoogleServicesSettingsUrl(settingsPage!.url())).toBe(true)
      await expect(googleServices).toBeVisible()
      await expect(sidePanel.locator('#syncHelpHeadingProgress')).toHaveText(' (2/2)')
      await expect(sidePanel.locator('.sync-help-finish-setup-btn')).toBeVisible()
    }
  })
})
