import path from 'node:path'
import { filterListDir, isMain } from './util'
import { FILTER_LIST_URL_MAPPING } from './filter-list-url-mapping'
import { readFile, writeFile } from 'node:fs/promises'

/** Reject downloads smaller than this even when no prior file exists. */
const ABSOLUTE_MIN_BYTES = 50_000

/** New size must stay within this ratio of the previously committed file. */
const MIN_SIZE_RATIO = 0.5
const MAX_SIZE_RATIO = 2.0

const looksLikeHtml = (text: string): boolean => {
  const head = text.slice(0, 512).trimStart().toLowerCase()
  return head.startsWith('<!doctype html') || head.startsWith('<html')
}

const looksLikeFilterList = (text: string): boolean => {
  const head = text.slice(0, 2048)
  const lines = head.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20)
  if (lines.length === 0) {
    return false
  }
  // Typical Adblock Plus / uBlock subscription header
  if (lines.some((l) => /^\[Adblock/i.test(l))) {
    return true
  }
  // Comment-header style (Title / Version) without a bracket header
  const commentLines = lines.filter((l) => l.startsWith('!'))
  if (commentLines.some((l) => /^!\s*(Title|Version|Expires|Last modified):/i.test(l))) {
    return true
  }
  return false
}

const assertDownloadSane = async (
  filename: string,
  response: Response,
  text: string,
  previousPath: string,
): Promise<void> => {
  if (!response.ok) {
    throw new Error(`${filename}: HTTP ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.toLowerCase().includes('text/html')) {
    throw new Error(`${filename}: unexpected Content-Type ${contentType}`)
  }

  if (looksLikeHtml(text)) {
    throw new Error(`${filename}: body looks like HTML, not a filter list`)
  }

  if (!looksLikeFilterList(text)) {
    throw new Error(
      `${filename}: body does not look like an Adblock-style filter list (missing [Adblock…] / ! Title: header)`,
    )
  }

  const newSize = text.length
  if (newSize < ABSOLUTE_MIN_BYTES) {
    throw new Error(
      `${filename}: download too small (${newSize} bytes; minimum ${ABSOLUTE_MIN_BYTES})`,
    )
  }

  let previousSize: number | undefined
  try {
    previousSize = (await readFile(previousPath)).byteLength
  } catch {
    previousSize = undefined
  }

  if (previousSize !== undefined && previousSize > 0) {
    const min = Math.floor(previousSize * MIN_SIZE_RATIO)
    const max = Math.ceil(previousSize * MAX_SIZE_RATIO)
    if (newSize < min || newSize > max) {
      throw new Error(
        `${filename}: size ${newSize} bytes is outside ${min}–${max} ` +
          `(${MIN_SIZE_RATIO}×–${MAX_SIZE_RATIO}× of previous ${previousSize} bytes)`,
      )
    }
  }
}

const fetchFilterLists = async (): Promise<void> => {
  for (const [filename, url] of Object.entries(FILTER_LIST_URL_MAPPING)) {
    const response = await fetch(url)
    const text = await response.text()
    const filePath = path.join(filterListDir, filename)
    await assertDownloadSane(filename, response, text, filePath)
    await writeFile(filePath, text)
    console.log(`Downloaded ${filename} to ${filePath} with file length ${text.length} bytes`)
  }
}

if (isMain(import.meta)) {
  await fetchFilterLists()
}
