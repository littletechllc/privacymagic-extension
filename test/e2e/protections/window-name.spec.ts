import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '../fixtures'
import { startStaticServer, type StaticServer } from '../helpers/static-server'

const pagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pages')

let originA: StaticServer
let originB: StaticServer

test.beforeAll(async () => {
  originA = await startStaticServer(pagesDir)
  originB = await startStaticServer(pagesDir)
})

test.afterAll(async () => {
  await originA.close()
  await originB.close()
})

const windowNamePage = (server: StaticServer, hop: string): string =>
  `${server.url}/window-name.html?hop=${hop}`

test('window.name stays with its origin across navigations', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.runtime.id)

  const page = await context.newPage()
  try {
    await page.goto(windowNamePage(originA, 'set'))
    await page.evaluate(() => {
      window.name = 'alpha'
    })
    expect(await page.evaluate(() => window.name)).toBe('alpha')

    await page.goto(windowNamePage(originA, 'same-origin'))
    expect(await page.evaluate(() => window.name)).toBe('alpha')

    await page.goto(windowNamePage(originB, 'other-origin'))
    expect(await page.evaluate(() => window.name)).toBe('')
    await page.evaluate(() => {
      window.name = 'beta'
    })
    expect(await page.evaluate(() => window.name)).toBe('beta')

    await page.goto(windowNamePage(originA, 'return'))
    expect(await page.evaluate(() => window.name)).toBe('alpha')

    await page.goto(windowNamePage(originB, 'return'))
    expect(await page.evaluate(() => window.name)).toBe('beta')
  } finally {
    await page.close()
  }
})
