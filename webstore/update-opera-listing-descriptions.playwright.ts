/**
 * Updates Opera Add-ons listing Description per locale via Playwright.
 *
 *   https://addons.opera.com/developer/package/<id>/version/<ver>?language=<locale>&tab=translations
 *
 * Sources: webstore/locales/<locale>/description.txt
 *
 *   npm run webstore:update-opera-listing-descriptions
 *
 * Env: OPERA_KEEP_OPEN=1, OPERA_MAX_LOCALES=N,
 *      OPERA_PACKAGE_ID, OPERA_PACKAGE_VERSION
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'

type Listing = { locale: string, description: string }

const packageId = process.env.OPERA_PACKAGE_ID?.trim() || '307183'
const packageVersion = process.env.OPERA_PACKAGE_VERSION?.trim() || '0.1.14'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, 'locales')
const userDataDir = path.join(__dirname, '.playwright-opera-user-data')
const discoverDir = path.join(__dirname, 'opera-discover')

const keepOpen = process.env.OPERA_KEEP_OPEN === '1'
const maxLocales = process.env.OPERA_MAX_LOCALES != null
  ? Number(process.env.OPERA_MAX_LOCALES)
  : undefined

const norm = (s: string) => s.replace(/\r\n/g, '\n').trim()

function translationsUrl(locale: string): string {
  return `https://addons.opera.com/developer/package/${packageId}/version/${packageVersion}?language=${encodeURIComponent(locale)}&tab=translations`
}

async function readListings(): Promise<Listing[]> {
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

async function screenshot(page: Page, name: string): Promise<void> {
  await fs.mkdir(discoverDir, { recursive: true })
  await page.screenshot({ path: path.join(discoverDir, name), fullPage: true }).catch(() => {})
}

async function waitForSignedIn(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  const url = page.url()
  const needsLogin =
    url.includes('auth.opera.com') ||
    url.includes('accounts.google.com') ||
    url.includes('/account/login') ||
    !url.includes('addons.opera.com/developer')
  if (!needsLogin) return
  process.stdout.write('Sign in to Opera developer, then wait for the package page.\n')
  await page.waitForURL(
    (u) =>
      u.hostname.includes('addons.opera.com') &&
      u.pathname.includes(`/developer/package/${packageId}/version/`),
    { timeout: 10 * 60 * 1000 }
  )
}

/** Translations pane: visible Description label + locale rail like "Arabic (ar)". */
async function translationsReady(page: Page): Promise<boolean> {
  const desc = page.locator('label').filter({ hasText: /^Description$/ })
  const rail = page.getByText(/\([a-z]{2}([-_][A-Za-z]+)?\)/)
  return (
    (await desc.filter({ visible: true }).count().catch(() => 0)) > 0 &&
    (await rail.filter({ visible: true }).count().catch(() => 0)) > 0
  )
}

async function ensureTranslations(page: Page, locale: string): Promise<void> {
  if (await translationsReady(page)) return

  for (let attempt = 1; attempt <= 3; attempt++) {
    process.stdout.write(`  [nav] open Translations (attempt ${attempt})\n`)
    const tab = page.getByText('Translations', { exact: true }).first()
    await tab.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => {})
      await page.waitForTimeout(600)
    } else {
      process.stdout.write(`  [nav] recovery goto ${translationsUrl(locale)}\n`)
      await page.goto(translationsUrl(locale), { waitUntil: 'domcontentloaded' })
    }
    if (await translationsReady(page)) return
  }

  await screenshot(page, 'translations-tab-failed.png')
  throw new Error(`Could not open Translations tab. URL: ${page.url()}`)
}

/** Left rail rows look like "Amharic (am)". */
async function selectLocale(page: Page, locale: string): Promise<void> {
  const re = new RegExp(`\\(${locale.replace('_', '[_-]?')}\\)\\s*$`)
  const rows = page.locator('a, button, li, div, span').filter({ hasText: re })
  const n = await rows.count()
  for (let i = 0; i < n; i++) {
    const el = rows.nth(i)
    if (!(await el.isVisible().catch(() => false))) continue
    const text = ((await el.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ')
    if (text.length > 80 || !re.test(text)) continue
    process.stdout.write(`  [nav] locale ${JSON.stringify(text)}\n`)
    await el.click()
    await page.waitForTimeout(400)
    return
  }
  throw new Error(`Locale rail entry not found for ${locale}`)
}

async function openLocale(page: Page, locale: string): Promise<void> {
  const onPackage = page.url().includes(
    `/developer/package/${packageId}/version/${packageVersion}`
  )
  if (!onPackage) {
    await page.goto(translationsUrl(locale), { waitUntil: 'domcontentloaded' })
  }
  await ensureTranslations(page, locale)
  // Tab click restores a sticky prior locale — always re-select from the rail.
  await selectLocale(page, locale)
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await translationsReady(page)) {
      process.stdout.write(`  [openLocale] ${locale} ready\n`)
      return
    }
    await page.waitForTimeout(200)
  }
  await screenshot(page, 'still-loading.png')
  throw new Error(`Timed out waiting for Translations UI (${locale})`)
}

async function descriptionField(page: Page) {
  const labels = page.locator('label').filter({ hasText: /^Description$/ })
  const count = await labels.count()
  for (let i = 0; i < count; i++) {
    const label = labels.nth(i)
    if (!(await label.isVisible().catch(() => false))) continue
    const forId = await label.getAttribute('for')
    if (forId) {
      const byFor = page.locator(`[id="${forId}"]`)
      if (await byFor.isVisible().catch(() => false)) return byFor
    }
    const following = label.locator('xpath=following::textarea[1]')
    if (await following.isVisible().catch(() => false)) return following
  }
  await screenshot(page, 'description-not-found.png')
  throw new Error('Visible Description textarea not found')
}

/** Green ✓ under a dirty Description; orange ↺ is the reset twin — skip it. */
async function clickAccept(page: Page, field: ReturnType<Page['locator']>): Promise<boolean> {
  const box = await field.boundingBox()
  if (box == null) return false
  const marker = 'data-pm-opera-accept'
  const deadline = Date.now() + 8_000

  while (Date.now() < deadline) {
    const found = await page.evaluate(({ box: b, markerAttr }) => {
      document.querySelectorAll(`[${markerAttr}]`).forEach((el) => el.removeAttribute(markerAttr))
      let best: HTMLElement | null = null
      let bestScore = -1
      for (const node of Array.from(document.querySelectorAll('button, a, span, div'))) {
        const el = node as HTMLElement
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (r.width < 24 || r.height < 24 || r.width > 480 || r.height > 120) continue
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        if (cy < b.y + b.height - 8 || cy > b.y + b.height + 160) continue
        if (cx < b.x - 40 || cx > b.x + b.width + 40) continue
        const label = `${el.innerText || ''} ${el.getAttribute('title') || ''} ${el.className || ''}`.toLowerCase()
        if (/reset|reject|undo|discard|submit changes|cancel/.test(label)) continue
        if (/[↺↻⟲⟳×]/.test(el.innerText || '')) continue
        const m = style.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (!m) continue
        const R = Number(m[1]), G = Number(m[2]), B = Number(m[3])
        if (R > 150 && R > G) continue // orange/red reset
        if (!(G > 120 && G >= R && G > B + 30)) continue // need green
        const score = G + (cx < b.x + b.width / 2 ? 50 : 0) // prefer left (accept)
        if (score > bestScore) {
          bestScore = score
          best = el
        }
      }
      if (best == null) return false
      const target = best.closest('button, a, [role="button"]') ?? best
      target.setAttribute(markerAttr, '1')
      return true
    }, { box, markerAttr: marker })

    if (found) {
      process.stdout.write('  [confirm] click green accept\n')
      await page.locator(`[${marker}="1"]`).first().click({ force: true })
      await page.waitForTimeout(400)
      return true
    }
    await page.waitForTimeout(250)
  }
  return false
}

async function updateLocale(page: Page, { locale, description }: Listing): Promise<void> {
  process.stdout.write(`Updating Opera locale: ${locale}\n`)
  await openLocale(page, locale)
  const field = await descriptionField(page)
  if (norm(await field.inputValue().catch(() => '') || '') === norm(description)) {
    process.stdout.write('  already current — skip\n')
    return
  }
  await field.click()
  await field.fill('')
  await field.fill(description)
  if (await clickAccept(page, field)) return
  if (norm(await field.inputValue().catch(() => '') || '') === norm(description)) {
    process.stdout.write('  accept not shown; value matches — ok\n')
    return
  }
  await screenshot(page, 'checkmark-not-found.png')
  throw new Error(`Accept button missing for ${locale}`)
}

async function main(): Promise<void> {
  const all = await readListings()
  const listings = maxLocales == null || Number.isNaN(maxLocales) ? all : all.slice(0, maxLocales)
  if (listings.length === 0) throw new Error(`No descriptions under ${localesDir}`)

  process.stdout.write(
    `Opera package ${packageId} v${packageVersion}: ${listings.length}/${all.length} locales.\n`
  )

  const context = await chromium.launchPersistentContext(userDataDir, { headless: false })
  try {
    const page = context.pages()[0] ?? await context.newPage()
    await page.goto(translationsUrl(listings[0].locale), { waitUntil: 'domcontentloaded' })
    await waitForSignedIn(page)

    for (const listing of listings) {
      await updateLocale(page, listing)
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
