import fs from 'node:fs/promises'
import path from 'node:path'
import { isMain } from './util'
import { fileURLToPath } from 'url'
import { parseNetworkFilterLine, generateBlockingRulesFile, isNetworkFilterLine } from './filter-list-helpers/network-rules'
import { parseCosmeticFilterLine, generateCosmeticFilterFiles, isCosmeticFilterLine } from './filter-list-helpers/cosmetic-rules'
import { parseScriptletLine, generateScriptletRulesFiles, isScriptletLine } from './filter-list-helpers/scriptlets'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BLOCKLISTS: string[] = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt'
]

// Fetch the lines from the given URL
const getLines = async (url: string): Promise<string[]> => {
  const response = await fetch(url)
  const content = await response.text()
  return content.split('\n')
}

// Fetch the lines from all the given URLs
const getAllLines = async (urls: string[]): Promise<string[]> => {
  const results = await Promise.all(urls.map(getLines))
  return results.flat()
}

const isCodingLine = (line: string): boolean => {
  const trimmed = line.trim()
  return !trimmed.startsWith('!') && trimmed.length > 0
}

const separateLines = (lines: string[]): { scriptletsLines: string[], cosmeticFiltersLines: string[], networkFiltersLines: string[] } => {
  const scriptletsLines: string[] = []
  const cosmeticFiltersLines: string[] = []
  const networkFiltersLines: string[] = []
  for (const line of lines) {
    if (isScriptletLine(line)) {
      scriptletsLines.push(line)
    } else if (isCosmeticFilterLine(line)) {
      cosmeticFiltersLines.push(line)
    } else if (isNetworkFilterLine(line)) {
      networkFiltersLines.push(line)
    }
  }
  return { scriptletsLines, cosmeticFiltersLines, networkFiltersLines }
}

const isGoodLine = (x: string): boolean => {
  const result = !x.startsWith('$websocket,domain=') &&
  !x.startsWith('$popup') &&
  !x.startsWith('$popup,third-party,domain=') &&
  !x.includes('Anâ€Œonâ€Œymous') &&
  !x.includes('συνεργασία') &&
  !x.includes('ได้รับการโปรโมท') &&
  !x.includes('Спонсорирани') &&
  !x.includes('परचरत') &&
  !x.includes('$/$') &&
  !x.includes('$)/$') &&
  !x.includes('abp-resource:') &&
  !x.includes(',important') &&
  !x.includes(' cookieman')
  if (!result) {
    console.log(x)
  }
  return result
}

const dist = (localPath: string): string => {
  return path.join(__dirname, '../dist/', localPath)
}

export const processAndWrite = async (): Promise<void> => {
  const lines = await getAllLines(BLOCKLISTS)
  const linesFiltered = lines.filter(isGoodLine).filter(isCodingLine)
  const { scriptletsLines, cosmeticFiltersLines, networkFiltersLines } = separateLines(linesFiltered)
  const scriptlets = scriptletsLines.map(parseScriptletLine).filter(scriptlet => scriptlet !== undefined)
  const cosmeticFilters = cosmeticFiltersLines.map(parseCosmeticFilterLine).filter(cosmeticFilter => cosmeticFilter !== undefined)
  const networkFilters = networkFiltersLines.map(parseNetworkFilterLine).filter(networkFilter => networkFilter !== undefined)
  const blockingRulesFileContent = generateBlockingRulesFile(networkFilters)
  await fs.mkdir(dist('rules'), { recursive: true })
  await fs.writeFile(dist('rules/easylist.json'),
    blockingRulesFileContent)
  await generateCosmeticFilterFiles(dist('content_scripts/cosmetic_filters'), cosmeticFilters)
  await generateScriptletRulesFiles(dist('content_scripts/scriptlets'), scriptlets)
}

if (isMain(import.meta)) {
  void processAndWrite()
}
