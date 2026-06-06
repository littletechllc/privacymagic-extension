import { COSMETIC_FILTERS_DIR, FILTER_LIST_DIR, PROCEDURAL_FILTERS_FILE } from '@src/common/filter-list-paths'
import { unique } from '@src/common/data-structures'
import { entries } from '../util'
import {
  COSMETIC_SEPARATOR,
  COSMETIC_EXCEPTION_SEPARATOR,
  PROCEDURAL_COSMETIC_SEPARATOR,
  logLineErrors,
  writeFile,
  appendCookieRule
} from './util'
import { PROCEDURAL_FILTERS_COOKIE_KEY } from '@src/common/setting-ids'
import { jsonToBase64Url } from '@src/common/base64'

type FilterType = 'standard' | 'procedural' | 'exception'

export type CosmeticFilter = {
  domains: string[]
  style: string
  selector: string
  type: FilterType
}

const SELECTOR_CHUNK_SIZE = 1024

const parseCosmeticFilterBody = (body: string): { selector: string, style: string } => {
  // ABP/uBO: ##selector:style(declarations)
  const styleParen = body.match(/(.*?):style\((.*?)\)/)
  if (styleParen !== null) {
    return { selector: styleParen[1], style: styleParen[2] }
  }
  // ABP/uBO: ##selector { declarations } (e.g. EasyList `.nav { top: 0; }`)
  const styleBrace = body.match(/^(.*?)\s+\{([^}]+)\}\s*$/)
  if (styleBrace !== null) {
    const selector = styleBrace[1].trim()
    const style = styleBrace[2].trim()
    if (selector.length === 0 || style.length === 0) {
      console.log('unsupported cosmetic brace filter:', body)
      return { selector: '', style: '' }
    }
    return { selector, style }
  }
  return { selector: body, style: 'display: none !important;' }
}

const parseCosmeticExceptionFilterBody = (body: string): { selector: string, style: string } => {
  if (body.includes(':style(')) {
    console.log('unsupported cosmetic exception filter style: ', body)
    return { selector: '', style: '' }
  }
  return { selector: body, style: 'display: revert !important;' }
}

const parseCosmeticFilterLine = (line: string): CosmeticFilter => {
  let type: FilterType = 'standard'
  let separator = COSMETIC_SEPARATOR
  if (line.includes(COSMETIC_EXCEPTION_SEPARATOR)) {
    type = 'exception'
    separator = COSMETIC_EXCEPTION_SEPARATOR
  }
  if (line.includes(PROCEDURAL_COSMETIC_SEPARATOR)) {
    type = 'procedural'
    separator = PROCEDURAL_COSMETIC_SEPARATOR
  }
  const [domainsString, body] = line.split(separator)
  // TODO: handle asterisks in domainsString
  const domainsRaw = domainsString.split(',')
  const domains = domainsRaw.filter(d => !d.endsWith('*'))
  const unsupportedDomains = domainsRaw.filter(d => d.endsWith('*'))
  if (unsupportedDomains.length > 0) {
    console.log('unsupported domains:', unsupportedDomains)
  }
  const { selector, style } = type === 'exception' ? parseCosmeticExceptionFilterBody(body) : parseCosmeticFilterBody(body)
  return { domains, style, selector, type }
}

const groupCosmeticFiltersByDomain = (cosmeticFilters: CosmeticFilter[]): Record<string, Record<string, string[]>> => {
  const cssItemsForDomain: Record<string, Record<string, string[]>> = {}
  for (const cosmeticFilter of cosmeticFilters) {
    for (const domain of cosmeticFilter.domains) {
      cssItemsForDomain[domain] ||= {}
      cssItemsForDomain[domain][cosmeticFilter.style] ||= []
      cssItemsForDomain[domain][cosmeticFilter.style].push(cosmeticFilter.selector)
    }
  }
  return cssItemsForDomain
}

const generateCssContent = (selectors: string[], style: string): string => {
  const lines: string[] = []
  const nChunks = Math.ceil(selectors.length / SELECTOR_CHUNK_SIZE)
  for (let i = 0; i < nChunks; ++i) {
    const selected = selectors.slice(SELECTOR_CHUNK_SIZE * i, SELECTOR_CHUNK_SIZE * (i + 1))
    const line = `html {\n${selected.join(',\n')} { ${style} }\n}`
    lines.push(line)
  }
  return lines.join('\n')
}

const generateCosmeticFilterFiles = async (dir: string, cosmeticFilters: CosmeticFilter[], exceptionFilters: CosmeticFilter[]): Promise<string[]> => {
  const cssItemsForDomain = groupCosmeticFiltersByDomain(cosmeticFilters)
  const cssExceptionsForDomain = groupCosmeticFiltersByDomain(exceptionFilters)
  const filestems = []
  for (const domain of unique([...Object.keys(cssItemsForDomain), ...Object.keys(cssExceptionsForDomain)])) {
    const cssItems = cssItemsForDomain[domain]
    const cssExceptions = cssExceptionsForDomain[domain]
    const lines = []
    if (cssItems !== undefined) {
      for (const [style, selectors] of entries(cssItems)) {
        const cssContent = generateCssContent(selectors.sort(), style)
        lines.push(cssContent)
      }
    }
    if (domain !== '' && cssExceptions !== undefined) {
      for (const [style, selectors] of entries(cssExceptions)) {
        const cssContent = generateCssContent(selectors.sort(), style)
        lines.push(cssContent)
      }
    }
    const filestem = domain === '' ? '_default' : domain
    const file = `${filestem}_.css`
    filestems.push(filestem)
    await writeFile(dir, file, lines.join('\n'))
  }
  await writeFile(dir, 'index.txt', filestems.sort().join('\n'))
  return filestems
}


const generateProceduralFilterRules = (proceduralFilters: CosmeticFilter[]): chrome.declarativeNetRequest.Rule[] => {
  const proceduralItemsForDomain = groupCosmeticFiltersByDomain(proceduralFilters)
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let id = 1
  for (const [domain, proceduralItems] of entries(proceduralItemsForDomain)) {
    const filters = []
    for (const [style, selectors] of entries(proceduralItems)) {
      for (const selector of selectors) {
        filters.push([selector, style])
      }
    }
    if (filters.length > 0) {
      const cookieValue = jsonToBase64Url(filters)
      rules.push(appendCookieRule(domain,  PROCEDURAL_FILTERS_COOKIE_KEY, cookieValue, id))
      ++id
    }
  }
  return rules
}

const generateProceduralFilterRulesFile = async (proceduralFilters: CosmeticFilter[]): Promise<void> => {
  const rules = generateProceduralFilterRules(proceduralFilters)
  const rulesBody = JSON.stringify(rules, null, 2)
  await writeFile(FILTER_LIST_DIR, PROCEDURAL_FILTERS_FILE, rulesBody)
}

export const parseAndGenerateCosmeticFilters = async (lines: string[]): Promise<void> => {
  const cosmeticFilters = lines.map(logLineErrors(parseCosmeticFilterLine)).filter(cosmeticFilter => cosmeticFilter.selector.length > 0)
  const standardCosmeticFilters = cosmeticFilters.filter(cosmeticFilter => cosmeticFilter.type === 'standard')
  const proceduralFilters = cosmeticFilters.filter(cosmeticFilter => cosmeticFilter.type === 'procedural')
  const exceptionFilters = cosmeticFilters.filter(cosmeticFilter => cosmeticFilter.type === 'exception')
  await generateCosmeticFilterFiles(COSMETIC_FILTERS_DIR, standardCosmeticFilters, exceptionFilters)
  await generateProceduralFilterRulesFile(proceduralFilters)
}
