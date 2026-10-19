import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FrameLocator, Locator, Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { startStaticServer, type StaticServer } from '../helpers/static-server'

const pagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pages')

let server: StaticServer

test.beforeAll(async () => {
  server = await startStaticServer(pagesDir)
})

test.afterAll(async () => {
  await server.close()
})

const inEveryRealm = (reading: unknown): unknown => ({
  page: reading,
  worker: reading,
  workerInWorker: reading,
  sharedWorker: reading
})

const expectedSpoofedValues = {
  audio: {
    page: {
      sampleRate: 48000,
      channelDataNoised: true,
      channelDataHighBitsPreserved: true
    }
  },
  battery: {
    page: {
      charging: true,
      chargingTime: 0,
      dischargingTime: 'Infinity',
      level: 1,
      onchargingchange: null,
      onchargingtimechange: null,
      ondischargingtimechange: null,
      onlevelchange: null
    }
  },
  cpu: inEveryRealm({
    hardwareConcurrency: { min: 4, max: 8 },
    stable: true
  }),
  device: {
    page: {
      type: 'continuous',
      onchange: null
    }
  },
  disk: inEveryRealm({
    usage: 0,
    quota: 2_147_483_648,
    usageDetails: {}
  }),
  display: {
    page: {
      noPreference: { matches: true, media: 'all' },
      reduce: { matches: false, media: 'not all' },
      bare: { matches: false, media: 'not all' }
    }
  },
  memory: inEveryRealm({
    present: true,
    deviceMemory: 'undefined'
  })
}

const surfaces = [
  { depth: 0, label: 'a top-level page' },
  { depth: 1, label: 'an iframe' },
  { depth: 2, label: 'a twice-nested iframe' }
]

const nestedProbePath = (probePath: string, depth: number): string => {
  let url = probePath
  for (let i = 0; i < depth; i += 1) {
    url = `iframe.html?src=${encodeURIComponent(url)}`
  }
  return url
}

const probeResult = (page: Page, depth: number): Locator => {
  let scope: Page | FrameLocator = page
  for (let i = 0; i < depth; i += 1) {
    scope = scope.frameLocator('#probe-frame')
  }
  return scope.locator('#probe-result')
}

const isIntegerRange = (value: unknown): value is { min: number, max: number } => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 2
    && typeof record.min === 'number'
    && typeof record.max === 'number'
}

const expectSpoofedValue = (actual: unknown, expected: unknown): void => {
  if (isIntegerRange(expected)) {
    expect(typeof actual).toBe('number')
    expect(Number.isInteger(actual)).toBe(true)
    expect(actual).toBeGreaterThanOrEqual(expected.min)
    expect(actual).toBeLessThanOrEqual(expected.max)
    return
  }
  if (
    actual != null
    && expected != null
    && typeof actual === 'object'
    && typeof expected === 'object'
    && !Array.isArray(actual)
    && !Array.isArray(expected)
  ) {
    const actualRecord = actual as Record<string, unknown>
    const expectedRecord = expected as Record<string, unknown>
    expect(Object.keys(actualRecord).sort()).toEqual(Object.keys(expectedRecord).sort())
    for (const key of Object.keys(expectedRecord)) {
      expectSpoofedValue(actualRecord[key], expectedRecord[key])
    }
    return
  }
  expect(actual).toEqual(expected)
}

const expectProbeResult = async (result: Locator, expected: unknown): Promise<void> => {
  await expect(result).not.toHaveAttribute('data-status', 'pending')
  const status = await result.getAttribute('data-status')
  const text = await result.textContent()
  expect(status, text ?? '').toBe('done')
  expectSpoofedValue(JSON.parse(text ?? ''), expected)
}

for (const name of Object.keys(expectedSpoofedValues) as Array<keyof typeof expectedSpoofedValues>) {
  for (const surface of surfaces) {
    test(`${surface.label} running the ${name} probe sees the spoofed value`, async ({ context, serviceWorker }) => {
      await serviceWorker.evaluate(() => chrome.runtime.id)

      const page = await context.newPage()
      try {
        await page.goto(`${server.url}/${nestedProbePath(`probe.html?src=probes/${name}.js`, surface.depth)}`)
        await expectProbeResult(probeResult(page, surface.depth), expectedSpoofedValues[name])
      } finally {
        await page.close()
      }
    })
  }
}
