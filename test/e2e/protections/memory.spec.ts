import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Locator } from '@playwright/test'
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

const expectSpoofedDeviceMemory = async (result: Locator): Promise<void> => {
  await expect(result).not.toHaveAttribute('data-status', 'pending')

  const status = await result.getAttribute('data-status')
  const text = await result.textContent()
  const reading: unknown = JSON.parse(text ?? '')
  expect(status, text ?? '').toBe('done')
  // The property stays present; its getter returns undefined.
  expect(reading).toEqual({
    page: spoofedDeviceMemory,
    worker: spoofedDeviceMemory,
    sharedWorker: spoofedDeviceMemory
  })
}

test('a page, worker, and shared worker reading navigator.deviceMemory see the spoofed value', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/memory.html`)
    await expectSpoofedDeviceMemory(page.locator('#memory-result'))
  } finally {
    await page.close()
  }
})

test('an iframe loading the memory probe sees the spoofed value', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/memory-iframe.html`)
    const result = page.frameLocator('#memory-frame').locator('#memory-result')
    await expectSpoofedDeviceMemory(result)
  } finally {
    await page.close()
  }
})

test('a twice-nested iframe loading the memory probe sees the spoofed value', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/memory-iframe-nested.html`)
    const result = page.frameLocator('#memory-outer-frame').frameLocator('#memory-frame').locator('#memory-result')
    await expectSpoofedDeviceMemory(result)
  } finally {
    await page.close()
  }
})
