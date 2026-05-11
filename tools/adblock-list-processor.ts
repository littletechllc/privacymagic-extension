import fs from 'node:fs/promises'
import path from 'node:path'
import { isMain } from './util'
import { fileURLToPath } from 'url'
import { type NetworkRuleWithoutId, parseNetworkFilter, generateBlockingRulesFile } from './filter-list-helpers/network-rules'
import { type ContentFilter, contentFilterSeparatorRegex, parseContentFilter, generateContentRules, generateContentRulesFiles } from './filter-list-helpers/cosmetic-rules'
import { type ScriptletInvocation, parseScriptletLine, generateScriptletRulesFiles } from './filter-list-helpers/scriptlets'

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

// Remove comments from the given lines
const removeComments = (lines: string[]): string[] =>
  lines.filter(line => {
    const trimmed = line.trim()
    return !trimmed.startsWith('!')
  }).slice(1)

const parseLines = (lines: string[]): { scriptlets: ScriptletInvocation[], contentFilters: ContentFilter[], networkFilters: NetworkRuleWithoutId[] } => {
  const codingLines = removeComments(lines).filter(line => line.length > 0)
  const scriptlets: ScriptletInvocation[] = []
  const contentFilters: ContentFilter[] = []
  const networkFilters: NetworkRuleWithoutId[] = []
  for (const line of codingLines) {
    try {
      if (line.includes('##+js(')) {
        const scriptlet = parseScriptletLine(line)
        if (scriptlet !== undefined) {
          scriptlets.push(scriptlet)
        }
      } else {
        // Check if the line is a content filter by looking for a separator
        const separatorMatch = line.match(contentFilterSeparatorRegex)
        if (separatorMatch !== null && separatorMatch !== undefined) {
          const contentFilter = parseContentFilter(line, separatorMatch[0])
          if (contentFilter !== undefined) {
            contentFilters.push(contentFilter)
          }
        } else {
          const networkFilter = parseNetworkFilter(line)
          if (networkFilter !== undefined) {
            networkFilters.push(networkFilter)
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        e.message = `Error in line '${line}':\n${e.message}`
      }
      throw e
    }
  }
  return { scriptlets, contentFilters, networkFilters }
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
  const linesFiltered = lines.filter(isGoodLine)
  const { scriptlets, contentFilters, networkFilters } = parseLines(linesFiltered)
  const blockingRulesFileContent = generateBlockingRulesFile(networkFilters)
  await fs.mkdir(dist('rules'), { recursive: true })
  await fs.writeFile(dist('rules/easylist.json'),
    blockingRulesFileContent)
  const contentRules = generateContentRules(contentFilters)
  await generateContentRulesFiles(dist('content_scripts/adblock_css'), contentRules)
  await generateScriptletRulesFiles(dist('content_scripts/scriptlets'), scriptlets)
}

if (isMain(import.meta)) {
  void processAndWrite()
}
