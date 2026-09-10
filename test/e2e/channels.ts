/**
 * E2E browser targets.
 *
 * Branded Google Chrome / Canary no longer honor `--load-extension` (Chrome 137+),
 * so extension e2e uses Chrome for Testing builds only:
 * - chromium: Playwright-managed CfT (pinned control)
 * - cft-stable / cft-canary: floating latest CfT channel builds (CI + daily cron)
 */
export const E2E_BROWSERS = ['chromium', 'cft-stable', 'cft-canary'] as const
export type E2EBrowser = (typeof E2E_BROWSERS)[number]
