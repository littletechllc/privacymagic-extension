import { COSMETIC_FILTERS_DIR, PROCEDURAL_FILTERS_DIR } from '@src/common/filter-list-paths'
import { unique } from '@src/common/data-structures'
import { entries } from '../util'
import {
  COSMETIC_SEPARATOR,
  COSMETIC_EXCEPTION_SEPARATOR,
  PROCEDURAL_COSMETIC_SEPARATOR,
  logLineErrors,
  writeFile
} from './util'

type FilterType = 'standard' | 'procedural' | 'exception'

export type CosmeticFilter = {
  domains: string[]
  style: string
  selector: string
  type: FilterType
}

const SELECTOR_CHUNK_SIZE = 1024

const parseCosmeticFilterBody = (body: string): { selector: string, style: string } => {
  const matches = body.match(/(.*?):style\((.*?)\)/)
  if (matches !== null && matches !== undefined) {
    return { selector: matches[1], style: matches[2] }
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

const enforceProceduralFilter = (selector: string, hasText: string, style: string) => {
  const matchesText = (text: string, hasTextContent: string): boolean => {
    if (hasTextContent.startsWith('/') && hasTextContent.endsWith('/')) {
      return new RegExp(hasTextContent.slice(1, -1)).test(text)
    }
    return text.includes(hasTextContent)
  }
  const applyStyleToElement = (element: Element) => {
    const originalStyle = element.getAttribute('style')
    if (originalStyle?.includes(style)) {
      return
    }
    const newStyle = originalStyle ? originalStyle + ';' + style : style
    element.setAttribute('style', newStyle)
  }
  const findMatchingElements = (root: Element) => {
    const possibleElements = [
      ...(root.matches(selector) ? [root] : []),
      ...Array.from(root.querySelectorAll(selector))
    ]
    return Array.from(possibleElements).filter(element => {
      const textContent = element.textContent ?? ''
      return matchesText(textContent, hasText)
    })
  }
  const applyStylesToMatchingElements = (root: Element) => {
    findMatchingElements(root).forEach(applyStyleToElement)
  }
  applyStylesToMatchingElements(document.documentElement)
  const observer = new MutationObserver((mutations: MutationRecord[]) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            applyStylesToMatchingElements(node)
          }
        })
      }
    })
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

const proceduralPrefix = `const enforceProceduralFilter = ${enforceProceduralFilter.toString()}`

const hasTextMatch = /^(.*?):has-text\((.*?)\)$/
const hasTextInsideHasMatch = /:has\([^)]*:has-text\(/

const processProceduralSelector = (selector: string): { processedSelector: string, hasText: string | undefined } => {
  if (hasTextInsideHasMatch.test(selector)) {
    return { processedSelector: selector, hasText: undefined }
  }
  const matches = selector.match(hasTextMatch)
  let processedSelector = selector
  let hasText: string | undefined = undefined
  if (matches !== null && matches !== undefined) {
    processedSelector = matches[1]
    hasText = matches[2]
  }
  return { processedSelector, hasText }
}

const generateProceduralFilterFiles = async (dir: string, proceduralFilters: CosmeticFilter[]): Promise<void> => {
  const proceduralItemsForDomain = groupCosmeticFiltersByDomain(proceduralFilters)
  const filestems = []
  for (const [domain, proceduralItems] of entries(proceduralItemsForDomain)) {
    const lines = []
    for (const [style, selectors] of entries(proceduralItems)) {
      for (const selector of selectors) {
        const { processedSelector, hasText } = processProceduralSelector(selector)
        if (hasText !== undefined) {
          lines.push(`enforceProceduralFilter(${JSON.stringify(processedSelector)}, ${JSON.stringify(hasText)}, ${JSON.stringify(style)})`)
        } else {
          console.log("unsupported procedural filter: ", domain, selector, style)
        }
      }
    }
    const body = [proceduralPrefix, ...lines, ''].join(';\n')
    const filestem = domain === '' ? '_default' : domain
    const file = `${filestem}_.js`
    await writeFile(dir, file, body)
    filestems.push(filestem)
  }
  await writeFile(dir, 'index.txt', filestems.sort().join('\n'))
}

export const parseAndGenerateCosmeticFilters = async (lines: string[]): Promise<void> => {
  const cosmeticFilters = lines.map(logLineErrors(parseCosmeticFilterLine)).filter(cosmeticFilter => cosmeticFilter.selector.length > 0)
  const standardCosmeticFilters = cosmeticFilters.filter(cosmeticFilter => cosmeticFilter.type === 'standard')
  const proceduralFilters = cosmeticFilters.filter(cosmeticFilter => cosmeticFilter.type === 'procedural')
  const exceptionFilters = cosmeticFilters.filter(cosmeticFilter => cosmeticFilter.type === 'exception')
  await generateCosmeticFilterFiles(COSMETIC_FILTERS_DIR, standardCosmeticFilters, exceptionFilters)
  await generateProceduralFilterFiles(PROCEDURAL_FILTERS_DIR, proceduralFilters)
}
