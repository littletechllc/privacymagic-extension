import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

test('a page reading the Battery Status API sees spoofed values', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/battery.html`)
    const result = page.locator('#battery-result')
    await expect(result).not.toHaveAttribute('data-status', 'pending')

    const status = await result.getAttribute('data-status')
    const text = await result.textContent()
    const reading: unknown = JSON.parse(text ?? '')
    expect(status, text ?? '').toBe('done')
    expect(reading).toEqual({
      charging: true,
      chargingTime: 0,
      dischargingTime: 'Infinity',
      level: 1,
      onchargingchange: null,
      onchargingtimechange: null,
      ondischargingtimechange: null,
      onlevelchange: null
    })
  } finally {
    await page.close()
  }
})
