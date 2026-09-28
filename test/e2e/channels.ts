/**
 * E2E browser targets.
 *
 * Branded Google Chrome no longer honors `--load-extension` (Chrome 137+),
 * so Chrome extension e2e uses Chrome for Testing builds only:
 * - chromium: Playwright-managed CfT (pinned control)
 * - cft-stable / cft-canary: floating latest CfT channel builds (CI + daily cron)
 *
 * Microsoft Edge is not Google Chrome branding, so `--load-extension` still works.
 * Microsoft does not publish a separate "Edge for Testing" binary. The Dev channel
 * is the weekly testing build, between Canary and Release:
 * - edge-testing: Edge Dev
 * - edge-release: Edge stable (Release)
 * - edge-canary: Edge Canary
 */
export const E2E_BROWSERS = [
  'chromium',
  'cft-stable',
  'cft-canary',
  'edge-testing',
  'edge-release',
  'edge-canary'
] as const
export type E2EBrowser = (typeof E2E_BROWSERS)[number]

const EDGE_E2E_BROWSERS = ['edge-testing', 'edge-release', 'edge-canary'] as const
export type EdgeE2EBrowser = (typeof EDGE_E2E_BROWSERS)[number]

export const isEdgeE2EBrowser = (browser: E2EBrowser): browser is EdgeE2EBrowser =>
  (EDGE_E2E_BROWSERS as readonly E2EBrowser[]).includes(browser)
