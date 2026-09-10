import { expect, test } from './fixtures'

test.describe('first install', () => {
  test('opens the setup page after the extension is installed', async ({ context }) => {
    const isSetupPage = (url: string): boolean =>
      url.includes('privacymagic/setup.html')

    const existing = context.pages().find((page) => isSetupPage(page.url()))
    const setupPage = existing ?? await context.waitForEvent('page', {
      predicate: (page) => isSetupPage(page.url()),
      timeout: 30_000
    })

    await setupPage.waitForLoadState('domcontentloaded')
    await expect(setupPage).toHaveTitle('Privacy Magic Setup')
    await expect(setupPage.locator('h1.setup-msg')).toHaveText('Welcome to Privacy Magic!')

    const cards = setupPage.locator('.step-card')
    await expect(cards).toHaveCount(3)
    for (const card of await cards.all()) {
      await expect(card).not.toHaveClass(/step-card-completed/)
      await expect(card).not.toHaveClass(/step-card-collapsed/)
    }
  })
})
