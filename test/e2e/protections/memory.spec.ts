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

test('a page reading navigator.deviceMemory sees the spoofed value', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/memory.html`)
    const result = page.locator('#memory-result')
    await expect(result).not.toHaveAttribute('data-status', 'pending')

    const status = await result.getAttribute('data-status')
    const text = await result.textContent()
    const reading: unknown = JSON.parse(text ?? '')
    expect(status, text ?? '').toBe('done')
    // The property stays present; its getter returns undefined.
    expect(reading).toEqual({
      present: true,
      deviceMemory: 'undefined'
    })
  } finally {
    await page.close()
  }
})
