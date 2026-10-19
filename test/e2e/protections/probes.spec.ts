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

const spoofedDeviceMemory = {
  present: true,
  deviceMemory: 'undefined'
}

const spoofedDisk = {
  usage: 0,
  quota: 2_147_483_648,
  usageDetails: {}
}

const inEveryRealm = (reading: unknown): unknown => ({
  page: reading,
  worker: reading,
  sharedWorker: reading
})

const probes = [
  {
    name: 'memory',
    path: 'memory-probe.html',
    expected: inEveryRealm(spoofedDeviceMemory)
  },
  {
    name: 'disk',
    path: 'disk-probe.html',
    expected: inEveryRealm(spoofedDisk)
  }
]

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

const expectProbeResult = async (result: Locator, expected: unknown): Promise<void> => {
  await expect(result).not.toHaveAttribute('data-status', 'pending')
  const status = await result.getAttribute('data-status')
  const text = await result.textContent()
  expect(status, text ?? '').toBe('done')
  expect(JSON.parse(text ?? '')).toEqual(expected)
}

for (const probe of probes) {
  for (const surface of surfaces) {
    test(`${surface.label} running the ${probe.name} probe sees the spoofed value`, async ({ context, serviceWorker }) => {
      await serviceWorker.evaluate(() => chrome.runtime.id)

      const page = await context.newPage()
      try {
        await page.goto(`${server.url}/${nestedProbePath(probe.path, surface.depth)}`)
        await expectProbeResult(probeResult(page, surface.depth), probe.expected)
      } finally {
        await page.close()
      }
    })
  }
}
