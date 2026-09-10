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
})
