import { defineConfig } from '@playwright/test'
import { E2E_BROWSERS } from './test/e2e/channels'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI != null ? 1 : 0,
  reporter: process.env.CI != null ? 'github' : 'list',
  // Chrome extensions require a headed browser (or new headless with caveats).
  use: {
    headless: false,
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry'
  },
  projects: E2E_BROWSERS.map((e2eBrowser) => ({
    name: e2eBrowser,
    use: { e2eBrowser }
  }))
})
