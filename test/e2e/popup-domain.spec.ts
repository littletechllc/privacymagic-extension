import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserContext, Worker } from '@playwright/test'
import { expect, test } from './fixtures'
import {
  closeSetupPages,
  openExtensionPopupForTab,
  tabIdForUrl
} from './helpers/chrome-extensions'
import { startStaticServer, type StaticServer } from './helpers/static-server'

const pagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'pages')

let server: StaticServer

test.beforeAll(async () => {
  server = await startStaticServer(pagesDir)
})

test.afterAll(async () => {
  await server.close()
})

const expectPopupDomain = async (
  context: BrowserContext,
  extensionId: string,
  serviceWorker: Worker,
  host: string,
  expectedDomain: string
): Promise<void> => {
  await serviceWorker.evaluate(() => chrome.runtime.id)
  await closeSetupPages(context)

  const port = new URL(server.url).port
  const siteUrl = `http://${host}:${port}/blank.html`

  const page = await context.newPage()
  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded' })
    const tabId = await tabIdForUrl(serviceWorker, siteUrl)

    const popup = await openExtensionPopupForTab(context, extensionId, tabId)
    try {
      await expect(popup.locator('.main-container')).toBeVisible()
      await expect(popup.locator('#domain')).toHaveText(expectedDomain)
    } finally {
      await popup.close()
    }
  } finally {
    await page.close()
  }
}

test('popup shows the registrable domain for a multi-label public suffix', async ({
  context,
  extensionId,
  serviceWorker
}) => {
  // www.example.co.uk → example.co.uk (co.uk is the public suffix).
  await expectPopupDomain(context, extensionId, serviceWorker, 'www.example.co.uk', 'example.co.uk')
})

test('popup shows Unicode for an internationalized domain', async ({
  context,
  extensionId,
  serviceWorker
}) => {
  // www.xn--bcher-kva.de is www.bücher.de; display encoding should prefer Unicode.
  await expectPopupDomain(context, extensionId, serviceWorker, 'www.xn--bcher-kva.de', 'bücher.de')
})
