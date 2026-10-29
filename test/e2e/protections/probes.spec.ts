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

const userAgentPlatform = process.platform === 'win32'
  ? 'Win32'
  : process.platform === 'linux'
    ? 'Linux x86_64'
    : 'MacIntel'

const gpuIdentity = process.platform === 'darwin'
  ? { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  : { vendor: 'Mozilla', renderer: 'Mozilla' }

const gpuReading = (canvasNoised: boolean | null): unknown => ({
  webgl1: gpuIdentity,
  webgl2: gpuIdentity,
  canvasNoised
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
      bare: { matches: false, media: 'not all' },
      contrastNoPreference: { matches: true, media: 'all' },
      contrastMore: { matches: false, media: 'not all' },
      contrastLess: { matches: false, media: 'not all' },
      contrastCustom: { matches: false, media: 'not all' },
      contrastBare: { matches: false, media: 'not all' },
      transparencyNoPreference: { matches: true, media: 'all' },
      transparencyReduce: { matches: false, media: 'not all' },
      transparencyBare: { matches: false, media: 'not all' }
    }
  },
  // Linux allows every font, so the patch adds no faces there.
  fonts: {
    page: {
      arial: false,
      gillSans: process.platform === 'win32',
      helveticaNeue: process.platform === 'win32',
      menlo: process.platform !== 'linux'
    }
  },
  gpc: inEveryRealm({
    present: true,
    globalPrivacyControl: true
  }),
  gpu: {
    page: gpuReading(true),
    worker: gpuReading(null),
    workerInWorker: gpuReading(null),
    sharedWorker: gpuReading(null)
  },
  keyboard: {
    page: {
      present: true,
      keyboard: 'undefined'
    }
  },
  language: inEveryRealm({
    language: 'en-US',
    first: 'en-US',
    count: { min: 1, max: 2 },
    onlyFirstBase: true
  }),
  math: inEveryRealm({
    cos: -0.4067775970251724,
    pow: 1.9275814160560204e-50,
    tan: -3.3537128705376014
  }),
  memory: inEveryRealm({
    present: true,
    deviceMemory: 'undefined'
  }),
  network: {
    page: {
      downlink: 100,
      effectiveType: '4g',
      rtt: 100,
      saveData: false
    }
  },
  screen: {
    page: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1080,
      availLeft: 0,
      availTop: 0,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: 2,
      screenX: 0,
      screenY: 0,
      screenLeft: 0,
      screenTop: 0,
      outerMatchesInner: true,
      sizeMatchesViewport: true,
      srgb: { matches: true, media: 'all' },
      p3: { matches: false, media: 'not all' }
    }
  },
  serviceWorker: {
    page: {
      name: 'SecurityError',
      message: 'Service workers blocked'
    }
  },
  sharedStorage: {
    page: {
      SharedStorage: false,
      SharedStorageAppendMethod: false,
      SharedStorageClearMethod: false,
      SharedStorageDeleteMethod: false,
      SharedStorageModifierMethod: false,
      SharedStorageSetMethod: false,
      SharedStorageWorklet: false,
      sharedStorage: false
    }
  },
  timer: inEveryRealm({
    nowInteger: true,
    nowAdvanced: true,
    timeOriginInteger: true
  }),
  timezone: inEveryRealm({
    vancouver: 'America/Los_Angeles',
    paris: 'Europe/Berlin',
    london: 'Europe/London'
  }),
  touch: {
    page: {
      present: true,
      maxTouchPoints: 0
    }
  },
  useragent: inEveryRealm({
    platform: userAgentPlatform,
    uaPlatform: userAgentPlatform,
    mobile: false,
    json: {
      mobile: false,
      platform: userAgentPlatform
    },
    fullVersionsReduced: true,
    uaFullVersionReduced: true
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
      test.skip(name === 'fonts' && process.platform === 'linux', 'font filtering is not applied on Linux')
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
