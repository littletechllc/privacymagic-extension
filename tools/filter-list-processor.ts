import { isMain } from './util'
import { isNetworkFilterLine, parseAndGenerateNetworkFilters } from './filter-list-helpers/network-rules'
import { isCosmeticFilterLine, parseAndGenerateCosmeticFilters } from './filter-list-helpers/cosmetic-rules'
import { isScriptletLine, parseAndGenerateScriptlets } from './filter-list-helpers/scriptlets'

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
    } else {
      console.log("unsupported line:", line)
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

export const processAndWrite = async (): Promise<void> => {
  const lines = await getAllLines(BLOCKLISTS)
  const linesFiltered = lines.filter(isGoodLine).filter(isCodingLine)
  const { scriptletsLines, cosmeticFiltersLines, networkFiltersLines } = separateLines(linesFiltered)
  await parseAndGenerateNetworkFilters(networkFiltersLines)
  await parseAndGenerateCosmeticFilters(cosmeticFiltersLines)
  await parseAndGenerateScriptlets(scriptletsLines)
}

if (isMain(import.meta)) {
  void processAndWrite()
}
