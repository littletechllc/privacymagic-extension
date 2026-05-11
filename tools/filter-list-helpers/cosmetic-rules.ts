import fs from 'node:fs/promises'
import path from 'node:path'
import { entries } from '../util'

export type CosmeticFilter = {
  domains: string[]
  style: string
  selector: string
}

const SELECTOR_CHUNK_SIZE = 1024
const SEPARATOR = '##'

export const isCosmeticFilterLine = (line: string): boolean => {
  return line.includes(SEPARATOR)
}

const parseCosmeticFilterBody = (body: string): { selector: string, style: string } => {
  const matches = body.match(/(.*?):style\((.*?)\)/)
  if (matches !== null && matches !== undefined) {
    return { selector: matches[1], style: matches[2] }
  }
  return { selector: body, style: 'display: none !important;' }
}

export const parseCosmeticFilter = (line: string): CosmeticFilter => {
  const [domainsString, body] = line.split(SEPARATOR)
  // TODO: handle asterisks in domainsString
  const domains = domainsString.split(',').filter(d => !d.endsWith('*'))
  const { selector, style } = parseCosmeticFilterBody(body)
  return { domains, style, selector }
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

export const generateCosmeticFilterFiles = async (dir: string, cosmeticFilters: CosmeticFilter[]): Promise<string[]> => {
  await fs.mkdir(dir, { recursive: true })
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
    await fs.writeFile(path.join(dir, file), lines.join('\n'))
  }
  return files
}
