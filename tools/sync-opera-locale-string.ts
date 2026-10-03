import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMain } from './util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const LOCALES_DIR = path.join(projectRoot, 'src', '_locales')
const OPERA_FRAMEWORK_VERSIONS_DIR =
  '/Applications/Opera.app/Contents/Frameworks/Opera Framework.framework/Versions'

// Opera locale.pak is Chromium data-pack version 5 with uint16 resource ids:
// header (12 bytes) then (uint16 id, uint32 offset) entries ending with id 0.
const PAK_HEADER_LENGTH = 12
const PAK_ENTRY_LENGTH = 6
const PAK_VERSION = 5
const PAK_ENCODING_UTF8 = 1

/** Exact English UI labels to import from Opera's locale.pak (resolved to resource ids at sync time). */
const OPERA_ENGLISH_STRINGS = [
  'Automatically send crash reports to Opera',
  'Help improve Opera by sending feature usage information',
  'Fetch images for suggested sources in News, based on history',
  'Display promotional notifications',
  'Receive promotional Speed Dials, bookmarks and campaigns',
  'Enable VPN'
] as const

type ChromeMessageEntry = {
  message: string
  description: string
}

type MessagesJson = Record<string, ChromeMessageEntry>

const toOperaMessageKey = (resourceId: number): string => {
  return `opera_${resourceId}`
}

const toOperaLprojName = (locale: string): string => {
  if (locale === 'no') {
    return 'nb'
  }
  return locale
}

const getLocaleDirectories = async (): Promise<string[]> => {
  const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

const resolveOperaResourcesDir = async (): Promise<string> => {
  const versions = await fs.readdir(OPERA_FRAMEWORK_VERSIONS_DIR)
  const numericVersions = versions
    .filter(name => /^\d+\.\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (numericVersions.length === 0) {
    throw new Error(`No Opera framework versions found in ${OPERA_FRAMEWORK_VERSIONS_DIR}`)
  }
  const latest = numericVersions[numericVersions.length - 1]
  return path.join(OPERA_FRAMEWORK_VERSIONS_DIR, latest, 'Resources')
}

type PakResources = {
  byId: Map<number, string>
  idByExactMessage: Map<string, number>
}

const readLocalePak = async (resourcesDir: string, lprojName: string): Promise<PakResources> => {
  const pakPath = path.join(resourcesDir, `${lprojName}.lproj`, 'locale.pak')
  const data = await fs.readFile(pakPath)
  if (data.length < PAK_HEADER_LENGTH) {
    throw new Error(`locale.pak for ${lprojName} is too small`)
  }

  const version = data.readUInt32LE(0)
  if (version !== PAK_VERSION) {
    throw new Error(`locale.pak for ${lprojName} has version ${version}, expected ${PAK_VERSION}`)
  }

  const encoding = data.readUInt8(4)
  if (encoding !== PAK_ENCODING_UTF8) {
    throw new Error(`locale.pak for ${lprojName} has unsupported text encoding ${encoding}`)
  }

  const entries: Array<{ id: number, offset: number }> = []
  let index = 0
  while (PAK_HEADER_LENGTH + (index + 1) * PAK_ENTRY_LENGTH <= data.length) {
    const entryOffset = PAK_HEADER_LENGTH + index * PAK_ENTRY_LENGTH
    const id = data.readUInt16LE(entryOffset)
    const offset = data.readUInt32LE(entryOffset + 2)
    entries.push({ id, offset })
    index += 1
    if (id === 0) {
      break
    }
  }
  if (entries.length === 0 || entries[entries.length - 1].id !== 0) {
    throw new Error(`locale.pak for ${lprojName} is missing a zero-id sentinel`)
  }

  const byId = new Map<number, string>()
  const idByExactMessage = new Map<string, number>()
  for (let i = 0; i < entries.length - 1; i++) {
    const entry = entries[i]
    const nextOffset = entries[i + 1].offset
    if (entry.offset > nextOffset || nextOffset > data.length) {
      throw new Error(`locale.pak for ${lprojName} has a corrupt range for id ${entry.id}`)
    }
    const text = data.subarray(entry.offset, nextOffset).toString('utf8').replace(/\0+$/u, '')
    byId.set(entry.id, text)
    // First exact match wins; Opera sometimes duplicates short labels.
    if (!idByExactMessage.has(text)) {
      idByExactMessage.set(text, entry.id)
    }
  }
  return { byId, idByExactMessage }
}

const resolveResourceIdsFromEnglish = async (
  resourcesDir: string
): Promise<Array<{ id: number, english: string }>> => {
  const englishPak = await readLocalePak(resourcesDir, 'en')
  return OPERA_ENGLISH_STRINGS.map(english => {
    const id = englishPak.idByExactMessage.get(english)
    if (id === undefined) {
      throw new Error(`English Opera locale.pak is missing exact string: ${JSON.stringify(english)}`)
    }
    return { id, english }
  })
}

const upsertMessagesForLocale = async (
  locale: string,
  messages: Array<{ id: number, message: string, description: string }>
): Promise<void> => {
  const messagesPath = path.join(LOCALES_DIR, locale, 'messages.json')
  const current = JSON.parse(await fs.readFile(messagesPath, 'utf8')) as MessagesJson
  for (const entry of messages) {
    current[toOperaMessageKey(entry.id)] = {
      message: entry.message,
      description: entry.description
    }
  }
  await fs.writeFile(messagesPath, JSON.stringify(current, null, 2) + '\n')
}

const syncOperaLocaleStrings = async (): Promise<void> => {
  const resourcesDir = await resolveOperaResourcesDir()
  console.log(`Using Opera resources: ${resourcesDir}`)
  const targets = await resolveResourceIdsFromEnglish(resourcesDir)
  for (const target of targets) {
    console.log(`Resolved ${toOperaMessageKey(target.id)} <= ${JSON.stringify(target.english)}`)
  }

  const locales = await getLocaleDirectories()
  const fallbackLocales: string[] = []

  for (const locale of locales) {
    const lprojName = toOperaLprojName(locale)
    const pakPath = path.join(resourcesDir, `${lprojName}.lproj`, 'locale.pak')
    let usedEnglishFallback = false
    let pak: PakResources | undefined
    try {
      await fs.access(pakPath)
      pak = await readLocalePak(resourcesDir, lprojName)
    } catch (error: unknown) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined
      if (code !== 'ENOENT') {
        throw error
      }
      usedEnglishFallback = true
      fallbackLocales.push(locale)
    }

    const entries = targets.map(target => {
      const translated = pak?.byId.get(target.id)
      const message = translated != null && translated.length > 0 ? translated : target.english
      const missingTranslation = translated == null || translated.length === 0
      if (message.includes('$')) {
        throw new Error(
          `Opera resource id ${target.id} for locale ${locale} contains '$', which messages.json would treat as a placeholder`
        )
      }
      return {
        id: target.id,
        message,
        description: usedEnglishFallback || missingTranslation
          ? `English fallback; Opera locale.pak for ${locale} missing resource id ${target.id}`
          : `Imported from Opera locale.pak resource id ${target.id}`
      }
    })

    await upsertMessagesForLocale(locale, entries)
    for (const entry of entries) {
      const suffix = entry.description.startsWith('English fallback') ? ' (English fallback)' : ''
      console.log(`Updated ${locale}: ${toOperaMessageKey(entry.id)}="${entry.message}"${suffix}`)
    }
  }

  console.log(`Done. Updated ${locales.length} locale(s).`)
  if (fallbackLocales.length > 0) {
    console.warn(`Opera does not ship locale.pak for: ${fallbackLocales.join(', ')}. Those messages.json files use the English labels.`)
  }
}

if (isMain(import.meta)) {
  void syncOperaLocaleStrings()
}

export { syncOperaLocaleStrings }
