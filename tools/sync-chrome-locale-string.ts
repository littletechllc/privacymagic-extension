import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMain } from './util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const CHROMIUM_RAW_BASE_URL = 'https://raw.githubusercontent.com/chromium/chromium/refs/heads/main'
const LOCALES_DIR = path.join(projectRoot, 'src', '_locales')
const PER_LOCALE_TIMEOUT_MS = 15_000

type SyncTarget = {
  translationId: string
  filePathTemplate: string
}

const GENERATED_RESOURCES_TEMPLATE = 'chrome/app/resources/generated_resources_%LOCALE%.xtb'
const GENERATED_RESOURCES_IDS = [
  '1644574205037202324',
  '4684427112815847243',
  '7399045143794278225',
  '7044606776288350625'
]

const SYNC_TARGETS: SyncTarget[] = GENERATED_RESOURCES_IDS.map(translationId => ({
  translationId,
  filePathTemplate: GENERATED_RESOURCES_TEMPLATE
}))

const toChromiumMessageKey = (translationId: string): string => {
  return `chromium_${translationId}`
}

const toLegacyChromeMessageKey = (translationId: string): string => {
  return `chrome_${translationId}`
}

const normalizeEnUsSpelling = (locale: string, message: string): string => {
  if (locale !== 'en') {
    return message
  }
  return message
    .replaceAll('Customise', 'Customize')
    .replaceAll('customise', 'customize')
}

const stripXmlTags = (raw: string): string => {
  return raw.replaceAll(/<[^>]+>/g, '')
}

const getLocaleDirectories = async (): Promise<string[]> => {
  const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

const toChromiumLocaleCandidates = (locale: string): string[] => {
  const hyphenLocale = locale.replaceAll('_', '-')
  const lowerHyphenLocale = hyphenLocale.toLowerCase()
  const lowerUnderscoreLocale = locale.toLowerCase()
  const candidates = [locale, hyphenLocale, lowerUnderscoreLocale, lowerHyphenLocale]

  if (locale === 'en') {
    candidates.unshift('en-GB')
  }

  if (locale === 'he') {
    candidates.unshift('iw')
  }

  if (locale === 'no') {
    candidates.unshift('nb')
  }

  return [...new Set(candidates)]
}

const fetchChromiumXtb = async (locale: string, filePathTemplate: string): Promise<string> => {
  const candidates = toChromiumLocaleCandidates(locale)
  let lastError: Error | undefined
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timeoutController.abort(`Timed out after ${PER_LOCALE_TIMEOUT_MS}ms`)
  }, PER_LOCALE_TIMEOUT_MS)

  try {
    for (const candidate of candidates) {
      const filePath = filePathTemplate.replaceAll('%LOCALE%', candidate)
      const url = `${CHROMIUM_RAW_BASE_URL}/${filePath}`

      try {
        const response = await fetch(url, { signal: timeoutController.signal })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const xtbBody = (await response.text()).trim()
        if (xtbBody.length === 0) {
          throw new Error('Empty response body')
        }
        return xtbBody
      } catch (error: unknown) {
        if (timeoutController.signal.aborted) {
          throw new Error(`Timed out while fetching locale '${locale}' for ${filePathTemplate}`)
        }
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    throw new Error(`No XTB found for locale '${locale}' in ${filePathTemplate}. Last error: ${lastError?.message ?? 'unknown error'}`)
  } finally {
    clearTimeout(timeoutId)
  }
}

const extractTranslation = (xtb: string, translationId: string): string | undefined => {
  const pattern = new RegExp(`<translation\\s+id="${translationId}"[^>]*>([\\s\\S]*?)<\\/translation>`)
  const match = xtb.match(pattern)
  if (!match) {
    return undefined
  }
  return stripXmlTags(match[1]).trim()
}

type ChromeMessageEntry = {
  message: string
  description: string
}

type MessagesJson = Record<string, ChromeMessageEntry>

const upsertMessageForLocale = async (
  locale: string,
  messages: Array<{ translationId: string, key: string, message: string, description: string }>
): Promise<void> => {
  const messagesPath = path.join(LOCALES_DIR, locale, 'messages.json')
  const current = JSON.parse(await fs.readFile(messagesPath, 'utf8')) as MessagesJson

  for (const entry of messages) {
    delete current[toLegacyChromeMessageKey(entry.translationId)]
    current[entry.key] = {
      message: entry.message,
      description: entry.description
    }
  }

  await fs.writeFile(messagesPath, JSON.stringify(current, null, 2) + '\n')
}

const syncChromeLocaleString = async (): Promise<void> => {
  const locales = await getLocaleDirectories()
  let synced = 0
  let skipped = 0
  const timedOutLocales: string[] = []
  const missingTranslationLocales: string[] = []
  const results = await Promise.all(locales.map(async (locale) => {
    try {
      const targetResults = await Promise.all(
        SYNC_TARGETS.map(async (target) => {
          const xtb = await fetchChromiumXtb(locale, target.filePathTemplate)
          const translation = extractTranslation(xtb, target.translationId)
          if (translation === undefined || translation.length === 0) {
            throw new Error(`Missing translation id ${target.translationId}`)
          }
          const normalizedTranslation = normalizeEnUsSpelling(locale, translation)
          return {
            translationId: target.translationId,
            key: toChromiumMessageKey(target.translationId),
            message: normalizedTranslation,
            description: `Imported from Chromium ${target.filePathTemplate} id ${target.translationId}`
          }
        })
      )

      await upsertMessageForLocale(locale, targetResults)
      for (const targetResult of targetResults) {
        console.log(`Updated ${locale}: ${targetResult.key}="${targetResult.message}"`)
      }
      return { locale, status: 'synced' as const }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Skipping ${locale}: ${message}`)
      return { locale, status: 'skipped' as const, message }
    }
  }))

  for (const result of results) {
    if (result.status === 'synced') {
      synced += 1
      continue
    }

    skipped += 1
    if (result.message.includes('Timed out while fetching locale')) {
      timedOutLocales.push(result.locale)
    }
    if (result.message.includes('Missing translation id')) {
      missingTranslationLocales.push(result.locale)
    }
  }

  console.log(`Done. Synced ${synced} locale(s), skipped ${skipped}.`)

  if (timedOutLocales.length > 0) {
    throw new Error(`Timed out locales: ${timedOutLocales.join(', ')}`)
  }
  if (missingTranslationLocales.length > 0) {
    throw new Error(`Missing translation id in locales: ${missingTranslationLocales.join(', ')}`)
  }
}

if (isMain(import.meta)) {
  void syncChromeLocaleString()
}

export { syncChromeLocaleString }
