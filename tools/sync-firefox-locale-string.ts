import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMain } from './util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const LOCALES_DIR = path.join(projectRoot, 'src', '_locales')
const PER_LOCALE_TIMEOUT_MS = 15_000
const MESSAGE_KEY = 'setupFirefoxPinToToolbar'
const FLUENT_MESSAGE_ID = 'unified-extensions-context-menu-pin-to-toolbar'
const FTL_PATH = 'browser/browser/unifiedExtensions.ftl'
const FIREFOX_L10N_RAW_BASE = 'https://raw.githubusercontent.com/mozilla-l10n/firefox-l10n/main'
const EN_US_FTL_URL = 'https://raw.githubusercontent.com/mozilla/gecko-dev/master/browser/locales/en-US/browser/unifiedExtensions.ftl'

/** Extension locale -> firefox-l10n directory. en-US comes from mozilla-central. */
const FIREFOX_L10N_LOCALE: Record<string, string> = {
  es: 'es-ES',
  es_419: 'es-MX',
  fil: 'tl',
  gu: 'gu-IN',
  hi: 'hi-IN',
  no: 'nb-NO',
  pt_BR: 'pt-BR',
  pt_PT: 'pt-PT',
  sv: 'sv-SE',
  zh_CN: 'zh-CN',
  zh_TW: 'zh-TW'
}

type ChromeMessageEntry = {
  message: string
  description: string
}

type MessagesJson = Record<string, ChromeMessageEntry>

const toFirefoxL10nLocale = (locale: string): string => {
  return FIREFOX_L10N_LOCALE[locale] ?? locale
}

const getLocaleDirectories = async (): Promise<string[]> => {
  const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

const ftlUrlForLocale = (locale: string): string => {
  if (locale === 'en') {
    return EN_US_FTL_URL
  }
  return `${FIREFOX_L10N_RAW_BASE}/${toFirefoxL10nLocale(locale)}/${FTL_PATH}`
}

const fetchFtl = async (locale: string): Promise<string> => {
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timeoutController.abort(`Timed out after ${PER_LOCALE_TIMEOUT_MS}ms`)
  }, PER_LOCALE_TIMEOUT_MS)
  try {
    const response = await fetch(ftlUrlForLocale(locale), { signal: timeoutController.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const body = (await response.text()).trim()
    if (body.length === 0) {
      throw new Error('Empty response body')
    }
    return body
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Read `.label` for unified-extensions-context-menu-pin-to-toolbar.
 * The English source is a single line: `.label = Pin to Toolbar`.
 */
const extractPinToToolbarLabel = (ftl: string): string => {
  const lines = ftl.split(/\r?\n/)
  const start = lines.findIndex(line => new RegExp(`^${FLUENT_MESSAGE_ID}\\s*=`).test(line))
  if (start < 0) {
    throw new Error(`Missing Fluent message ${FLUENT_MESSAGE_ID}`)
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (i > start && /^[A-Za-z]/.test(line)) {
      break
    }
    const label = line.match(/^\s*\.label\s*=\s*(.*)$/)
    if (label == null) {
      continue
    }
    const inline = (label[1] ?? '').trim()
    if (inline !== '') {
      return inline
    }
    const parts: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j] ?? ''
      if (!/^\s+\S/.test(next) || /^\s*\.[A-Za-z]/.test(next)) {
        break
      }
      parts.push(next.trim())
    }
    const joined = parts.join(' ').trim()
    if (joined === '') {
      throw new Error(`Empty .label for ${FLUENT_MESSAGE_ID}`)
    }
    return joined
  }

  throw new Error(`Missing .label for ${FLUENT_MESSAGE_ID}`)
}

const escapeForMessage = (phrase: string): string => {
  if (phrase.includes('{')) {
    throw new Error(`Pin to Toolbar phrase contains a Fluent placeable: ${phrase}`)
  }
  return phrase
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('$', '$$')
}

/** Leading space keeps the sentence after the previous period. */
const sentenceForPhrase = (phrase: string): string => {
  return ` Click <strong>${escapeForMessage(phrase)}</strong>.`
}

const descriptionFor = (locale: string, usedEnglishFallback: boolean): string => {
  const source = locale === 'en'
    ? 'mozilla-central browser/locales/en-US/browser/unifiedExtensions.ftl'
    : `firefox-l10n ${toFirefoxL10nLocale(locale)}/${FTL_PATH}`
  const imported = `Firefox ${FLUENT_MESSAGE_ID} .label from ${source}, wrapped for the step 1 sentence. Includes a leading space.`
  if (!usedEnglishFallback) {
    return imported
  }
  return `English fallback; Firefox l10n has no ${FLUENT_MESSAGE_ID} for ${locale}. ${imported}`
}

const syncFirefoxLocaleString = async (): Promise<void> => {
  const locales = await getLocaleDirectories()
  const englishPhrase = extractPinToToolbarLabel(await fetchFtl('en'))
  const fallbackLocales: string[] = []

  for (const locale of locales) {
    let phrase = englishPhrase
    let usedEnglishFallback = false
    if (locale !== 'en') {
      try {
        phrase = extractPinToToolbarLabel(await fetchFtl(locale))
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const missing = message.startsWith('HTTP 404') || message.startsWith('Missing Fluent message') || message.startsWith('Missing .label') || message.startsWith('Empty .label')
        if (!missing) {
          throw new Error(`${locale}: ${message}`)
        }
        usedEnglishFallback = true
        fallbackLocales.push(locale)
        phrase = englishPhrase
      }
    }

    const messagesPath = path.join(LOCALES_DIR, locale, 'messages.json')
    const current = JSON.parse(await fs.readFile(messagesPath, 'utf8')) as MessagesJson
    current[MESSAGE_KEY] = {
      message: sentenceForPhrase(phrase),
      description: descriptionFor(locale, usedEnglishFallback)
    }
    await fs.writeFile(messagesPath, JSON.stringify(current, null, 2) + '\n')
    const suffix = usedEnglishFallback ? ' (English fallback)' : ''
    console.log(`Updated ${locale}: ${MESSAGE_KEY} phrase="${phrase}"${suffix}`)
  }

  console.log(`Done. Updated ${locales.length} locale(s).`)
  if (fallbackLocales.length > 0) {
    console.warn(`Firefox l10n has no ${FLUENT_MESSAGE_ID} for: ${fallbackLocales.join(', ')}. Those messages.json files use the English phrase.`)
  }
}

if (isMain(import.meta)) {
  void syncFirefoxLocaleString()
}

export { syncFirefoxLocaleString }
