import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const extensionDistPath = path.join(repoRoot, 'dist')

const assertExtensionBuilt = (): void => {
  const manifestPath = path.join(extensionDistPath, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Extension build not found at ${manifestPath}. Run \`npm run build\` before e2e tests.`
    )
  }
}

type ExtensionFixtures = {
  context: BrowserContext
  extensionId: string
  serviceWorker: Worker
}

/**
 * Launches Chromium with the unpacked extension from dist/ in a fresh profile,
 * so chrome.runtime.onInstalled fires with reason "install".
 */
export const test = base.extend<ExtensionFixtures>({
  // Override default context: fresh profile + unpacked extension from dist/.
  context: async ({}, use) => {
    assertExtensionBuilt()
    const userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pm-e2e-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: false,
      args: [
        `--disable-extensions-except=${extensionDistPath}`,
        `--load-extension=${extensionDistPath}`
      ]
    })
    try {
      await use(context)
    } finally {
      await context.close()
      await fs.promises.rm(userDataDir, { recursive: true, force: true })
    }
  },

  serviceWorker: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0]
    if (worker == null) {
      worker = await context.waitForEvent('serviceworker')
    }
    await use(worker)
  },

  extensionId: async ({ serviceWorker }, use) => {
    const url = serviceWorker.url()
    // chrome-extension://<id>/...
    const extensionId = new URL(url).host
    await use(extensionId)
  }
})

export const expect = test.expect
