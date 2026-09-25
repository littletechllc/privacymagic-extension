import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMain } from './util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const LOCALES_DIR = path.join(projectRoot, 'src', '_locales')
const EDGE_RESOURCES_DIR = '/Applications/Microsoft Edge.app/Contents/Frameworks/Microsoft Edge Framework.framework/Versions/Current/Resources'

// Edge locale.pak is a Chromium v5 data pack, but resource ids exceed uint16
// (this install goes past 65535), so each index entry is uint32 offset + uint32 id
// instead of Chromium's uint16 id + uint32 offset. A final sentinel entry has id 0
// and the offset just past the last resource. Text encoding 1 is UTF-8.
const PAK_HEADER_LENGTH = 12
const PAK_ENTRY_LENGTH = 8
const PAK_VERSION = 5
const PAK_ENCODING_UTF8 = 1
const PAK_ENCODING_UTF16 = 2

// Toggle labels on edge://settings/privacy/privacy
const EDGE_RESOURCE_IDS = [
  8757, // Send optional diagnostic data to improve Microsoft products
  8834, // Help improve Microsoft products by sending the results from searches on the web
  19254 // Allow Microsoft to save your browsing activity...
] as const

type ChromeMessageEntry = {
  message: string
  description: string
}

type MessagesJson = Record<string, ChromeMessageEntry>

const toEdgeMessageKey = (resourceId: number): string => {
  return `edge_${resourceId}`
}

const toEdgeLprojName = (locale: string): string => {
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

const readLocalePak = async (lprojName: string): Promise<Map<number, string>> => {
  const pakPath = path.join(EDGE_RESOURCES_DIR, `${lprojName}.lproj`, 'locale.pak')
  const data = await fs.readFile(pakPath)
  if (data.length < PAK_HEADER_LENGTH) {
    throw new Error(`locale.pak for ${lprojName} is too small`)
  }

  const version = data.readUInt32LE(0)
  if (version !== PAK_VERSION) {
    throw new Error(`locale.pak for ${lprojName} has version ${version}, expected ${PAK_VERSION}`)
  }

  const encoding = data.readUInt8(4)
  if (encoding !== PAK_ENCODING_UTF8 && encoding !== PAK_ENCODING_UTF16) {
    throw new Error(`locale.pak for ${lprojName} has unsupported text encoding ${encoding}`)
  }

  const resourceCount = data.readUInt16LE(8)
  const aliasCount = data.readUInt16LE(10)
  if (aliasCount !== 0) {
    throw new Error(`locale.pak for ${lprojName} has an alias table (${aliasCount}); this script only reads direct entries`)
  }

  const tableBytes = (resourceCount + 1) * PAK_ENTRY_LENGTH
  if (PAK_HEADER_LENGTH + tableBytes > data.length) {
    throw new Error(`locale.pak for ${lprojName} index overruns the file`)
  }

  const entries: Array<{ id: number, offset: number }> = []
  let previousOffset = -1
  for (let index = 0; index < resourceCount; index++) {
    const entryOffset = PAK_HEADER_LENGTH + index * PAK_ENTRY_LENGTH
    const offset = data.readUInt32LE(entryOffset)
    const id = data.readUInt32LE(entryOffset + 4)
    if (offset < previousOffset || offset > data.length) {
      throw new Error(`locale.pak for ${lprojName} has a corrupt index at entry ${index}`)
    }
    entries.push({ id, offset })
    previousOffset = offset
  }

  const sentinelOffset = PAK_HEADER_LENGTH + resourceCount * PAK_ENTRY_LENGTH
  const endOffset = data.readUInt32LE(sentinelOffset)
  const sentinelId = data.readUInt32LE(sentinelOffset + 4)
  if (sentinelId !== 0) {
    throw new Error(`locale.pak for ${lprojName} sentinel id is ${sentinelId}, expected 0`)
  }
  if (endOffset < previousOffset || endOffset > data.length) {
    throw new Error(`locale.pak for ${lprojName} sentinel offset is out of range`)
  }

  const resources = new Map<number, string>()
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const nextOffset = index + 1 < entries.length ? entries[index + 1].offset : endOffset
    const bytes = data.subarray(entry.offset, nextOffset)
    const text = encoding === PAK_ENCODING_UTF16
      ? bytes.toString('utf16le')
      : bytes.toString('utf8')
    resources.set(entry.id, text.replace(/\0+$/u, ''))
  }
  return resources
}

const lookupResources = (resources: Map<number, string>, locale: string): Array<{ id: number, message: string }> => {
  return EDGE_RESOURCE_IDS.map(id => {
    const message = resources.get(id)
    if (message === undefined || message.length === 0) {
      throw new Error(`Missing Edge resource id ${id} for locale ${locale}`)
    }
    if (message.includes('$')) {
      throw new Error(`Edge resource id ${id} for locale ${locale} contains '$', which messages.json would treat as a placeholder`)
    }
    return { id, message }
  })
}

const upsertMessagesForLocale = async (
  locale: string,
  messages: Array<{ id: number, message: string, description: string }>
): Promise<void> => {
  const messagesPath = path.join(LOCALES_DIR, locale, 'messages.json')
  const current = JSON.parse(await fs.readFile(messagesPath, 'utf8')) as MessagesJson
  for (const entry of messages) {
    current[toEdgeMessageKey(entry.id)] = {
      message: entry.message,
      description: entry.description
    }
  }
  await fs.writeFile(messagesPath, JSON.stringify(current, null, 2) + '\n')
}

const syncEdgeLocaleStrings = async (): Promise<void> => {
  const locales = await getLocaleDirectories()
  const english = lookupResources(await readLocalePak('en'), 'en')
  const englishById = new Map(english.map(entry => [entry.id, entry.message]))
  const fallbackLocales: string[] = []

  for (const locale of locales) {
    const lprojName = toEdgeLprojName(locale)
    const pakPath = path.join(EDGE_RESOURCES_DIR, `${lprojName}.lproj`, 'locale.pak')
    let extracted: Array<{ id: number, message: string }>
    let usedEnglishFallback = false
    try {
      await fs.access(pakPath)
      extracted = lookupResources(await readLocalePak(lprojName), locale)
    } catch (error: unknown) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined
      if (code !== 'ENOENT') {
        throw error
      }
      usedEnglishFallback = true
      fallbackLocales.push(locale)
      extracted = EDGE_RESOURCE_IDS.map(id => {
        const message = englishById.get(id)
        if (message === undefined) {
          throw new Error(`Missing English Edge resource id ${id}`)
        }
        return { id, message }
      })
    }

    const entries = extracted.map(entry => ({
      id: entry.id,
      message: entry.message,
      description: usedEnglishFallback
        ? `English fallback; Microsoft Edge has no locale.pak for ${locale}. Resource id ${entry.id}`
        : `Imported from Microsoft Edge locale.pak resource id ${entry.id}`
    }))
    await upsertMessagesForLocale(locale, entries)
    for (const entry of entries) {
      const suffix = usedEnglishFallback ? ' (English fallback)' : ''
      console.log(`Updated ${locale}: ${toEdgeMessageKey(entry.id)}="${entry.message}"${suffix}`)
    }
  }

  console.log(`Done. Updated ${locales.length} locale(s).`)
  if (fallbackLocales.length > 0) {
    console.warn(`Edge does not ship locale.pak for: ${fallbackLocales.join(', ')}. Those messages.json files use the English labels.`)
  }
}

if (isMain(import.meta)) {
  void syncEdgeLocaleStrings()
}

export { syncEdgeLocaleStrings }
