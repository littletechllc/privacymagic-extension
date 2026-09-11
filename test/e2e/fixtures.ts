import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test'
import { type E2EBrowser } from './channels'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const extensionDistPath = path.join(repoRoot, 'dist')

export type { E2EBrowser }
export { E2E_BROWSERS } from './channels'

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

type ExtensionOptions = {
  /** Which Chrome-for-Testing flavor to launch (see playwright.config projects). */
  e2eBrowser: E2EBrowser
}

/**
 * Launches Chrome for Testing with the unpacked extension from dist/ in a fresh profile,
 * so chrome.runtime.onInstalled fires with reason "install".
 */
export const test = base.extend<ExtensionFixtures, ExtensionOptions>({
  e2eBrowser: ['chromium', { scope: 'worker', option: true }],

  // Override default context: fresh profile + unpacked extension from dist/.
  context: async ({ e2eBrowser }, use) => {
    assertExtensionBuilt()
    // Required for chrome.sidePanel pages to appear in context.pages().
    process.env.PW_CHROMIUM_ATTACH_TO_OTHER = '1'
    const userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pm-e2e-'))
    const executablePath = process.env.PM_E2E_EXECUTABLE_PATH
    const needsExternalBinary = e2eBrowser !== 'chromium'

    if (needsExternalBinary && (executablePath == null || executablePath === '')) {
      throw new Error(
        `PM_E2E_EXECUTABLE_PATH is required for e2eBrowser=${e2eBrowser} ` +
        '(Chrome for Testing stable/canary binary).'
      )
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: needsExternalBinary ? undefined : 'chromium',
      executablePath: needsExternalBinary ? executablePath : undefined,
      headless: false,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
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
