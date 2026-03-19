import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type BrowserContext, type Page } from 'playwright'

type LocaleDescription = {
  locale: string
  description: string
}

const publisherId = 'b0774b45-c87c-4ea9-b664-44b539d6c83f'
const itemId = 'cobojehlalmfnplnblndhofhgeglljkc'
const listingUrl = `https://chrome.google.com/u/3/webstore/devconsole/${publisherId}/${itemId}/edit/listing`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, 'locales')
const keepBrowserOpen = false
const maxLocalesToProcess: number | undefined = undefined

// Centralized selectors so they can be adjusted easily if CWS UI changes.
const selectors = {
  languagePickerCandidates: [
    'select[aria-label*="Language"]',
    'select[aria-label*="language"]',
    '[aria-label*="Language"][role="combobox"]',
    '[aria-label*="language"][role="combobox"]',
    '[role="combobox"][aria-label*="locale"]',
    '[role="combobox"][aria-label*="Locale"]',
    // Material/Google-style controls seen in CWS listing page:
    '[role="combobox"]',
    '[aria-haspopup="listbox"]',
    '.mat-mdc-select-trigger',
    '.mdc-select__anchor'
  ],
  languageOptionListItem: '[role="option"], mat-option, .mat-mdc-option',
  // Material/overlay containers that hold the currently opened dropdown options.
  openDropdownOptionScope: '.cdk-overlay-pane, .cdk-overlay-container, [role="listbox"]',
  detailedDescriptionInput: 'textarea[aria-label*="Detailed description"], textarea[name*="description"], textarea',
  saveDraftButton: 'button:has-text("Save draft")'
}
const devConsolePathFragment = '/webstore/devconsole/'

function mapLocaleToCws(locale: string): string {
  // CWS generally uses hyphenated locale tags, with a few legacy aliases.
  const normalized = locale.replace('_', '-')
  if (normalized === 'he') return 'iw'
  return normalized
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readLocaleDescriptions(): Promise<LocaleDescription[]> {
  const entries = await fs.readdir(localesDir, { withFileTypes: true })
  const locales = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()

  const result: LocaleDescription[] = []
  for (const locale of locales) {
    const descriptionPath = path.join(localesDir, locale, 'description.txt')
    try {
      const raw = await fs.readFile(descriptionPath, 'utf8')
      result.push({
        locale,
        description: raw.replace(/\r\n/g, '\n').trimEnd()
      })
    } catch {
      // Ignore locales without description.txt.
    }
  }
  return result
}

function isUsablePage(page: Page): boolean {
  return !page.isClosed()
}

function findListingPage(context: BrowserContext): Page | undefined {
  return context
    .pages()
    .find((p) => isUsablePage(p) && p.url().includes(devConsolePathFragment))
}

async function waitForListingPage(context: BrowserContext, timeoutMs: number): Promise<Page> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const listingPage = findListingPage(context)
    if (listingPage != null) return listingPage
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for a listing page (${timeoutMs} ms)`)
}

async function waitForSignedInListingPage(context: BrowserContext, page: Page): Promise<Page> {
  // Give you time to complete Google sign-in if needed.
  // If you are already signed in, this returns quickly.
  await page.waitForLoadState('domcontentloaded')
  const currentUrl = page.url()
  if (currentUrl.includes('accounts.google.com')) {
    process.stdout.write('Please sign in to Google in the opened browser tab, then continue.\n')
    return await waitForListingPage(context, 5 * 60 * 1000)
  }
  return page
}

async function findVisibleLanguagePicker(page: Page): Promise<ReturnType<Page['locator']>> {
  // First try to anchor around the visible "Language" field label.
  const labeledContainer = page.locator(':is(label,legend,div,span):has-text("Language")').first()
  if (await labeledContainer.count() > 0) {
    const nearby = labeledContainer.locator(
      'xpath=following::*[@role="combobox" or @aria-haspopup="listbox" or contains(@class,"mat-mdc-select-trigger")][1]'
    ).first()
    if (await nearby.count() > 0 && await nearby.isVisible()) {
      return nearby
    }
    // Fall through to general candidates.
  }

  for (const candidate of selectors.languagePickerCandidates) {
    const locator = page.locator(candidate)
    const count = await locator.count()
    for (let i = 0; i < count; i++) {
      const nth = locator.nth(i)
      if (await nth.isVisible()) {
        return nth
      }
    }
  }

  // Last-resort fallback: click the currently displayed locale text in the Language field.
  // Example visible value: "English – en (default)"
  const languageValueFallback = page.locator('text=/\\s-\\s[a-z]{2}(-[A-Z]{2})?(\\s\\(default\\))?$/').first()
  if (await languageValueFallback.count() > 0 && await languageValueFallback.isVisible()) {
    return languageValueFallback
  }

  // Diagnostic artifact to help tune selectors quickly.
  await page.screenshot({ path: path.join(__dirname, 'listing-language-picker-not-found.png'), fullPage: true })
  throw new Error(
    `Could not find a visible language picker. Screenshot saved to ${path.join(__dirname, 'listing-language-picker-not-found.png')}`
  )
}

async function selectLanguage(page: Page, locale: string): Promise<void> {
  const cwsLocale = mapLocaleToCws(locale)
  const localeBase = cwsLocale.split('-')[0]
  const escapedLocale = escapeRegExp(cwsLocale)
  const escapedLocaleBase = escapeRegExp(localeBase)
  const targetLocalePattern = new RegExp(`(?:-|–)\\s*(?:${escapedLocale}|${escapedLocaleBase})(?:\\b|\\s|\\()`, 'i')
  let selectionApproach = 'unknown'

  const picker = await findVisibleLanguagePicker(page)
  const tagName = await picker.evaluate((el) => el.tagName.toLowerCase())

  if (tagName === 'select') {
    await picker.selectOption([
      { value: cwsLocale },
      { value: locale },
      { label: cwsLocale },
      { label: locale }
    ])
    selectionApproach = 'native-select'
    process.stdout.write(`  [selectLanguage] ${locale}: ${selectionApproach}\n`)
    return
  }

  await picker.click()

  const getPickerText = async (): Promise<string> => {
    // Prefer dedicated "selected value" nodes to avoid reading broad container text.
    const selectedValueLocators = [
      '.mat-mdc-select-value-text',
      '.mat-mdc-select-min-line',
      '.mdc-select__selected-text',
      '[class*="select-value"]'
    ]
    for (const selector of selectedValueLocators) {
      const candidate = picker.locator(selector).first()
      if (await candidate.count().catch(() => 0)) {
        const valueText = (await candidate.innerText().catch(() => '')).trim()
        if (valueText.length > 0) return valueText
      }
    }

    const text = (await picker.innerText().catch(() => '')).trim()
    if (text.length > 0) return text
    return (await picker.inputValue().catch(() => '')).trim()
  }
  const waitForPickerLocale = async (): Promise<boolean> => {
    const deadline = Date.now() + 900
    while (Date.now() < deadline) {
      const text = await getPickerText()
      if (targetLocalePattern.test(text)) return true
      await page.waitForTimeout(50)
    }
    return false
  }
  const beforeText = await getPickerText()

  // Wait briefly for any visible dropdown option to render.
  // Using waitForSelector (any-match) avoids per-locale timeouts caused by locator.first().
  try {
    await page.waitForSelector(
      `${selectors.openDropdownOptionScope} ${selectors.languageOptionListItem}`,
      { state: 'visible', timeout: 300 }
    )
  } catch {
    // Continue with fallback queries below.
  }

  const directOption = page.locator(
    `${selectors.openDropdownOptionScope} ${selectors.languageOptionListItem}[data-value="${cwsLocale}"], ` +
    `${selectors.openDropdownOptionScope} ${selectors.languageOptionListItem}[data-value="${locale}"]`
  ).first()
  if (await directOption.count() > 0) {
    await directOption.click({ timeout: 5000, force: true })
    if (await waitForPickerLocale()) {
      selectionApproach = 'data-value-direct'
      process.stdout.write(`  [selectLanguage] ${locale}: ${selectionApproach}\n`)
      return
    }
  }

  // Match text patterns commonly used in CWS: "English – en (default)", "Amharic – am", etc.
  const clickOptionByLocalePattern = async (pattern: RegExp): Promise<boolean> => {
    const optionSelector = `${selectors.openDropdownOptionScope} ${selectors.languageOptionListItem}`
    const optionsInOpenDropdown = page.locator(optionSelector).filter({ hasText: pattern })

    const count = await optionsInOpenDropdown.count()
    for (let i = 0; i < count; i++) {
      const option = optionsInOpenDropdown.nth(i)

      // Fast path: dispatch click in-page without actionability/viewport constraints.
      const optionText = (await option.innerText().catch(() => '')).trim()
      const domClickSucceeded = await page.evaluate(
        ({ selector, text }) => {
          const items = Array.from(document.querySelectorAll<HTMLElement>(selector))
          const target = items.find((el) => (el.innerText ?? '').trim() === text)
          if (target == null) return false
          target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
          target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
          target.click()
          return true
        },
        { selector: optionSelector, text: optionText }
      ).catch(() => false)
      if (domClickSucceeded && await waitForPickerLocale()) return true

      // Fallback for UI variants that ignore synthetic clicks.
      await option.scrollIntoViewIfNeeded().catch(() => {})
      await option.click({ timeout: 5000, force: true }).catch(() => {})
      if (await waitForPickerLocale()) return true
    }
    return false
  }

  // Preferred: exact locale code suffix in option text, e.g. "German - de", "Portuguese - pt-BR"
  if (await clickOptionByLocalePattern(new RegExp(`(?:-|–)\\s*${escapedLocale}(?:\\b|\\s|\\()`, 'i'))) {
    // selected
    selectionApproach = 'pattern-locale-suffix'
  } else if (await clickOptionByLocalePattern(new RegExp(`\\b${escapedLocale}\\b`, 'i'))) {
    // selected
    selectionApproach = 'pattern-exact-locale'
  } else if (await clickOptionByLocalePattern(new RegExp(`(?:-|–)\\s*${escapedLocaleBase}(?:\\b|\\s|\\()`, 'i'))) {
    // base-language fallback
    selectionApproach = 'pattern-base-locale-suffix'
  } else if (await clickOptionByLocalePattern(new RegExp(`\\b${escapeRegExp(locale)}\\b`, 'i'))) {
    // raw locale text fallback
    selectionApproach = 'pattern-raw-locale'
  } else {
    const visibleOptions = await page
      .locator(`${selectors.openDropdownOptionScope} ${selectors.languageOptionListItem}`)
      .allInnerTexts()
      .catch(() => [])
    await page.screenshot({ path: path.join(__dirname, `listing-language-option-not-found-${locale}.png`), fullPage: true })
    throw new Error(
      `Could not select language option for locale "${locale}" (mapped "${cwsLocale}"). ` +
      `Picker before="${beforeText}". Visible options=${JSON.stringify(visibleOptions.slice(0, 40))}`
    )
  }

  // Final strict verification on the same picker element.
  const finalText = await getPickerText()
  if (!targetLocalePattern.test(finalText)) {
    throw new Error(
      `Language appears unchanged after selection attempt for locale "${locale}" (mapped "${cwsLocale}"). ` +
      `Picker before="${beforeText}", after="${finalText}"`
    )
  }
  process.stdout.write(`  [selectLanguage] ${locale}: ${selectionApproach}\n`)
}

async function fillDetailedDescription(page: Page, description: string): Promise<void> {
  const descriptionInput = page.locator(selectors.detailedDescriptionInput).first()
  await descriptionInput.waitFor({ state: 'visible', timeout: 30000 })
  await descriptionInput.fill(description)
}

async function applyDescriptions(
  context: BrowserContext,
  startingPage: Page,
  localeDescriptions: LocaleDescription[]
): Promise<void> {
  let activePage = startingPage
  for (const { locale, description } of localeDescriptions) {
    // Fast path: keep using the same page while it's still usable and on devconsole.
    if (!isUsablePage(activePage) || !activePage.url().includes(devConsolePathFragment)) {
      activePage = await waitForListingPage(context, 8_000)
    }

    process.stdout.write(`Updating locale: ${locale}\n`)
    const localeStart = Date.now()
    const selectStart = Date.now()
    await selectLanguage(activePage, locale)
    const selectMs = Date.now() - selectStart
    const fillStart = Date.now()
    await fillDetailedDescription(activePage, description)
    const fillMs = Date.now() - fillStart
    const totalMs = Date.now() - localeStart
    process.stdout.write(`  [timing] ${locale}: select=${selectMs}ms fill=${fillMs}ms total=${totalMs}ms\n`)
  }
}

async function saveDraft(page: Page): Promise<void> {
  const saveButton = page.locator(selectors.saveDraftButton).first()
  await saveButton.waitFor({ state: 'visible', timeout: 30000 })
  await saveButton.click()

  // Give CWS time to persist changes before teardown/navigation.
  // Prefer an explicit "saved" signal when present, otherwise fall back
  // to a short settle delay.
  try {
    await page.waitForSelector('text=/saved|draft saved|changes saved/i', { timeout: 4000 })
  } catch {
    await page.waitForTimeout(1500)
  }
}

async function main(): Promise<void> {
  const allLocaleDescriptions = await readLocaleDescriptions()
  const localeDescriptions = maxLocalesToProcess == null
    ? allLocaleDescriptions
    : allLocaleDescriptions.slice(0, maxLocalesToProcess)
  if (localeDescriptions.length === 0) {
    throw new Error(`No locale descriptions found under ${localesDir}`)
  }
  process.stdout.write(`Processing ${localeDescriptions.length}/${allLocaleDescriptions.length} locales.\n`)

  const context: BrowserContext = await chromium.launchPersistentContext(
    path.join(__dirname, '.playwright-user-data'),
    { headless: false }
  )

  try {
    const initialPage = context.pages()[0] ?? await context.newPage()
    await initialPage.goto(listingUrl, { waitUntil: 'domcontentloaded' })
    const listingPage = await waitForSignedInListingPage(context, initialPage)
    await applyDescriptions(context, listingPage, localeDescriptions)
    await saveDraft(listingPage)
    process.stdout.write('Done: updated all locales and clicked Save draft.\n')
  } finally {
    if (keepBrowserOpen) {
      process.stdout.write('Browser left open for verification. Close it manually when done.\n')
    } else {
      await context.close()
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

