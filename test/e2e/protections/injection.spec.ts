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

const expectSpoofedConcurrency = (value: unknown): void => {
  expect(typeof value).toBe('number')
  expect(Number.isInteger(value)).toBe(true)
  expect(value).toBeGreaterThanOrEqual(4)
  expect(value).toBeLessThanOrEqual(8)
}

test('a same-task iframe contentWindow is patched', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/window-name.html`)
    const value = await page.evaluate(() => {
      const iframe = document.createElement('iframe')
      document.body.appendChild(iframe)
      const contentWindow = iframe.contentWindow
      if (contentWindow == null) {
        throw new Error('iframe contentWindow is missing')
      }
      return contentWindow.navigator.hardwareConcurrency
    })
    expectSpoofedConcurrency(value)
  } finally {
    await page.close()
  }
})

test('a sandboxed iframe without scripts is patched from the parent', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/window-name.html`)
    const value = await page.evaluate(() => {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('sandbox', 'allow-same-origin')
      document.body.appendChild(iframe)
      const contentWindow = iframe.contentWindow
      if (contentWindow == null) {
        throw new Error('iframe contentWindow is missing')
      }
      return contentWindow.navigator.hardwareConcurrency
    })
    expectSpoofedConcurrency(value)
  } finally {
    await page.close()
  }
})

test('a blob worker receives the injected patches', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/window-name.html`)
    const value = await page.evaluate(async () => {
      const blob = new Blob([
        'postMessage(navigator.hardwareConcurrency)'
      ], { type: 'text/javascript' })
      const url = URL.createObjectURL(blob)
      const worker = new Worker(url)
      return await new Promise((resolve, reject) => {
        worker.onmessage = (event) => {
          resolve(event.data)
        }
        worker.onerror = () => {
          reject(new Error('blob worker failed'))
        }
      })
    })
    expectSpoofedConcurrency(value)
  } finally {
    await page.close()
  }
})

test('a shared worker is cached as a blob URL and stays patched', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(`${server.url}/window-name.html`)
    const result = await page.evaluate(async () => {
      const workerUrl = new URL('injection-shared-worker.js', location.href).href
      const listen = (worker: SharedWorker): Promise<unknown> => new Promise((resolve, reject) => {
        worker.port.onmessage = (event) => {
          resolve(event.data)
        }
        worker.onerror = () => {
          reject(new Error('shared worker failed'))
        }
      })
      const first = new SharedWorker(workerUrl)
      const firstValue = listen(first)
      const cached = Object.keys(localStorage)
        .filter((key) => key.startsWith('--privacy-magic-sw:') && key.includes('injection-shared-worker.js'))
        .map((key) => localStorage.getItem(key))
      const second = new SharedWorker(workerUrl)
      return {
        cached,
        firstValue: await firstValue,
        secondValue: await listen(second)
      }
    })
    expect(result.cached.some((url) => url?.startsWith('blob:'))).toBe(true)
    expectSpoofedConcurrency(result.firstValue)
    expectSpoofedConcurrency(result.secondValue)
  } finally {
    await page.close()
  }
})
