/**
 * Updates Edge Add-ons Partner Center listing descriptions via storeListings API.
 *
 * Signs in once, GETs all storeListings, then PUTs each locale's description
 * from inside the page (session cookies + Chromium TLS).
 *
 *   npm run webstore:update-edge-listing-descriptions
 *
 * Env: EDGE_KEEP_OPEN=1, EDGE_MAX_LOCALES=N, EDGE_START_LOCALE=cs, EDGE_PRODUCT_ID
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'

type Listing = { locale: string, description: string }
type StoreListing = Record<string, unknown> & {
  id?: string
  description?: string | null
  languageId?: number
  title?: string | null
}

const productId = process.env.EDGE_PRODUCT_ID?.trim() || '351de19c-5df3-4d18-9cb4-50add9fc18e0'
const listingsUrl =
  `https://partner.microsoft.com/en-us/dashboard/microsoftedge/${productId}/listings`
const storeListingsUrl =
  `https://partner.microsoft.com/en-us/dashboard/microsoftedge/api/${productId}/listings/storeListings`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, 'locales')
const userDataDir = path.join(__dirname, '.playwright-edge-user-data')

const keepOpen = process.env.EDGE_KEEP_OPEN === '1'
const maxLocales = process.env.EDGE_MAX_LOCALES != null
  ? Number(process.env.EDGE_MAX_LOCALES)
  : undefined
const startLocale = process.env.EDGE_START_LOCALE?.trim() || undefined

/** Partner Center storeListings.languageId → locale folder. */
const LANGUAGE_ID_TO_LOCALE: Record<number, string> = {
  1: 'en',
  5: 'zh_CN',
  8: 'ar',
  9: 'de',
  10: 'es',
  11: 'hi',
  12: 'ja',
  18: 'fr',
  20: 'ru',
  26: 'bg',
  31: 'hr',
  34: 'da',
  37: 'et',
  39: 'fi',
  41: 'el',
  55: 'he',
  58: 'it',
  60: 'ko',
  62: 'lv',
  64: 'lt',
  67: 'nl',
  72: 'pl',
  74: 'pt_BR',
  75: 'pt_PT',
  76: 'ro',
  78: 'sk',
  84: 'sv',
  88: 'zh_TW',
  89: 'th',
  91: 'tr',
  93: 'uk',
  102: 'sl',
  104: 'hu',
  188: 'am',
  194: 'bn',
  197: 'ca',
  198: 'cs',
  201: 'fil',
  203: 'gu',
  207: 'id',
  211: 'kn',
  216: 'sw',
  222: 'ms',
  223: 'ml',
  226: 'mr',
  232: 'fa',
  236: 'sr',
  242: 'ta',
  244: 'te',
  250: 'vi',
  491: 'no',
  831: 'es_419'
}

const norm = (s: string) => s.replace(/\r\n/g, '\n').trim()

async function readListings (): Promise<Listing[]> {
  const dirs = (await fs.readdir(localesDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
  const out: Listing[] = []
  for (const locale of dirs) {
    try {
      const raw = await fs.readFile(path.join(localesDir, locale, 'description.txt'), 'utf8')
      out.push({ locale, description: raw.replace(/\r\n/g, '\n').trimEnd() })
    } catch {
      // no description.txt
    }
  }
  return out
}

function selectListings (all: Listing[]): Listing[] {
  let listings = all
  if (startLocale != null) {
    const startIdx = all.findIndex((l) => l.locale === startLocale)
    if (startIdx < 0) {
      throw new Error(
        `EDGE_START_LOCALE=${startLocale} not found. Have: ${all.map((l) => l.locale).join(', ')}`
      )
    }
    listings = all.slice(startIdx)
  }
  if (maxLocales != null && !Number.isNaN(maxLocales)) {
    listings = listings.slice(0, maxLocales)
  }
  return listings
}

async function waitForSignedIn (page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  if (page.url().includes(`/microsoftedge/${productId}/listings`)) return

  process.stdout.write('Sign in to Partner Center, then wait for the Store listings page.\n')
  await page.waitForURL(
    (u) =>
      u.hostname.includes('partner.microsoft.com') &&
      u.pathname.includes(`/microsoftedge/${productId}/`),
    { timeout: 10 * 60 * 1000 }
  )
  if (!page.url().includes('/listings')) {
    await page.goto(listingsUrl, { waitUntil: 'domcontentloaded' })
  }
}

async function fetchStoreListings (page: Page): Promise<StoreListing[]> {
  const wait = page.waitForResponse(
    (res) =>
      res.request().method() === 'GET' &&
      res.url().toLowerCase().includes('/listings/storelistings') &&
      !/storeListings\/[^/?]+$/i.test(res.url()) &&
      res.status() >= 200 && res.status() < 300,
    { timeout: 60_000 }
  )

  if (!page.url().includes('/listings')) {
    await page.goto(listingsUrl, { waitUntil: 'domcontentloaded' })
  } else {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }

  const json = await (await wait).json()
  const list = Array.isArray(json) ? json as StoreListing[] : []
  process.stdout.write(`[api] GET storeListings → ${list.length} items\n`)
  if (list.length === 0) throw new Error('storeListings list was empty')
  return list
}

async function putDescription (
  page: Page,
  item: StoreListing,
  description: string
): Promise<void> {
  const id = item.id
  if (id == null) throw new Error('storeListing missing id')

  const result = await page.evaluate(async ({ url, body }) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(body)
    })
    return { status: res.status, text: (await res.text()).slice(0, 400) }
  }, {
    url: `${storeListingsUrl}/${id}`,
    body: { ...item, description, entityDataStateChanged: true }
  })

  process.stdout.write(`  [put] ${result.status} ${id}\n`)
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`PUT failed ${result.status}: ${result.text}`)
  }
}

async function main (): Promise<void> {
  const all = await readListings()
  const listings = selectListings(all)
  if (listings.length === 0) throw new Error(`No descriptions under ${localesDir}`)

  process.stdout.write(
    `Edge product ${productId}: ${listings.length}/${all.length} locales` +
    (startLocale != null ? ` (from ${startLocale})` : '') +
    `.\nListings URL: ${listingsUrl}\n`
  )

  const context = await chromium.launchPersistentContext(userDataDir, { headless: false })
  try {
    const page = context.pages()[0] ?? await context.newPage()
    await page.goto(listingsUrl, { waitUntil: 'domcontentloaded' })
    await waitForSignedIn(page)

    const storeListings = await fetchStoreListings(page)
    const byLocale = new Map<string, StoreListing>()
    for (const item of storeListings) {
      const locale = LANGUAGE_ID_TO_LOCALE[Number(item.languageId)]
      if (locale == null) {
        process.stdout.write(
          `  [warn] unknown languageId=${item.languageId} ` +
          `title=${JSON.stringify(String(item.title || '').slice(0, 40))}\n`
        )
        continue
      }
      byLocale.set(locale, item)
    }
    process.stdout.write(`[api] mapped ${byLocale.size}/${storeListings.length} listings\n`)

    for (const { locale, description } of listings) {
      process.stdout.write(`Updating Edge locale: ${locale}\n`)
      const item = byLocale.get(locale)
      if (item == null) {
        process.stdout.write(`  skip ${locale}: not in storeListings\n`)
        continue
      }
      if (norm(String(item.description || '')) === norm(description)) {
        process.stdout.write('  already current\n')
        continue
      }
      await putDescription(page, item, description)
      item.description = description
      process.stdout.write(`  saved ${locale}\n`)
    }
    process.stdout.write('Done.\n')
  } finally {
    if (keepOpen) {
      process.stdout.write('Browser left open. Close it manually when done.\n')
    } else {
      await context.close()
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exitCode = 1
})
