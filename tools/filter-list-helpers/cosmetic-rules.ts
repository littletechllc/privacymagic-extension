import { COSMETIC_FILTERS_DIR, PROCEDURAL_FILTERS_DIR } from '@src/common/filter-list-paths'
import { entries } from '../util'
import { writeFile, logLineErrors } from './util'

export type CosmeticFilter = {
  domains: string[]
  style: string
  selector: string
  procedural?: boolean
}

const SELECTOR_CHUNK_SIZE = 1024
const SEPARATOR = '##'
const PROCEDURAL_SEPARATOR = '#?#'

export const isCosmeticFilterLine = (line: string): boolean => {
  return line.includes(SEPARATOR) || line.includes(PROCEDURAL_SEPARATOR)
}

const parseCosmeticFilterBody = (body: string): { selector: string, style: string } => {
  const matches = body.match(/(.*?):style\((.*?)\)/)
  if (matches !== null && matches !== undefined) {
    return { selector: matches[1], style: matches[2] }
  }
  return { selector: body, style: 'display: none !important;' }
}

const hasTextMatch = /^(.*?):has-text\((.*?)\)$/

const processProceduralSelector = (selector: string): { processedSelector: string, hasText: string | undefined } => {
  const matches = selector.match(hasTextMatch)
  let processedSelector = selector
  let hasText: string | undefined = undefined
  if (matches !== null && matches !== undefined) {
    processedSelector = matches[1]
    hasText = matches[2]
  }
  return { processedSelector, hasText }
}

const parseCosmeticFilterLine = (line: string): CosmeticFilter => {
  let procedural = false
  if (line.includes(PROCEDURAL_SEPARATOR)) {
    procedural = true
  }
  const separator = procedural ? PROCEDURAL_SEPARATOR : SEPARATOR
  const [domainsString, body] = line.split(separator)
  // TODO: handle asterisks in domainsString
  const domains = domainsString.split(',').filter(d => !d.endsWith('*'))
  const { selector, style } = parseCosmeticFilterBody(body)
  return { domains, style, selector, procedural }
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

const generateCosmeticFilterFiles = async (dir: string, cosmeticFilters: CosmeticFilter[]): Promise<string[]> => {
  const cssItemsForDomain = groupCosmeticFiltersByDomain(cosmeticFilters)
  const files: string[] = []
  for (const [domain, cssItems] of entries(cssItemsForDomain)) {
    const lines = []
    for (const [style, selectors] of entries(cssItems)) {
      const selectorsSorted = selectors.sort()
      const nChunks = Math.ceil(selectorsSorted.length / SELECTOR_CHUNK_SIZE)
      for (let i = 0; i < nChunks; ++i) {
        const selected = selectorsSorted.slice(SELECTOR_CHUNK_SIZE * i, SELECTOR_CHUNK_SIZE * (i + 1))
        const line = `html {\n${selected.join(',\n')} { ${style} }\n}`
        lines.push(line)
      }
    }
    const filestem = domain === '' ? '_default' : domain
    const file = `${filestem}_.css`
    files.push(file)
    await writeFile(dir, file, lines.join('\n'))
  }
  return files
}

const enforceProceduralFilter = (selector: string, hasText: string, style: string) => {
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
    return Array.from(possibleElements).filter(element => element.textContent?.includes(hasText))
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

const generateProceduralFilterFiles = async (dir: string, proceduralFilters: CosmeticFilter[]): Promise<void> => {
  const proceduralItemsForDomain = groupCosmeticFiltersByDomain(proceduralFilters)
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
  }
}

export const parseAndGenerateCosmeticFilters = async (lines: string[]): Promise<void> => {
  const cosmeticFilters = lines.map(logLineErrors(parseCosmeticFilterLine)).filter(cosmeticFilter => cosmeticFilter !== undefined)
  const standardCosmeticFilters = cosmeticFilters.filter(cosmeticFilter => !cosmeticFilter.procedural)
  const proceduralFilters = cosmeticFilters.filter(cosmeticFilter => cosmeticFilter.procedural)
  await generateCosmeticFilterFiles(COSMETIC_FILTERS_DIR, standardCosmeticFilters)
  await generateProceduralFilterFiles(PROCEDURAL_FILTERS_DIR, proceduralFilters)
}
