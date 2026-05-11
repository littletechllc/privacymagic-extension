import fs from 'node:fs/promises'
import path from 'node:path'
import { entries } from '../util'

export type ContentFilterBody = {
  style: string
  selector: string
}

export type ContentFilter = {
  domains: string[]
  separator: string
  body: ContentFilterBody
}

const SELECTOR_CHUNK_SIZE = 1024

export const contentFilterSeparatorRegex = /#\?#|#@#|#S#|##/

const parseContentFilterBody = (body: string): ContentFilterBody => {
  const matches = body.match(/(.*?):style\((.*?)\)/)
  if (matches !== null && matches !== undefined) {
    return { selector: matches[1], style: matches[2] }
  }
  return { selector: body, style: 'display: none !important;' }
}

export const parseContentFilter = (line: string, separator: string): ContentFilter => {
  const [domainsString, body] = line.split(separator)
  // TODO: handle asterisks in domainsString
  const domains = domainsString.split(',').filter(d => !d.endsWith('*'))
  const { selector, style } = parseContentFilterBody(body)
  return { domains, separator, body: { selector, style } }
}

export const generateContentRules = (contentFilters: ContentFilter[]): Record<string, Record<string, string[]>> => {
  const cssItemsForDomain: Record<string, Record<string, string[]>> = {}
  for (const contentFilter of contentFilters) {
    if (contentFilter.separator !== '##') {
      // TODO: handle other separators
      console.log('skipping non-## separator', contentFilter)
      continue
    }
    if (contentFilter.body.selector.includes('has-text') || contentFilter.body.selector.startsWith('+js(')) {
      console.log('skipping odd selector', contentFilter)
      continue
    }
    for (const domain of contentFilter.domains) {
      cssItemsForDomain[domain] ||= {}
      cssItemsForDomain[domain][contentFilter.body.style] ||= []
      cssItemsForDomain[domain][contentFilter.body.style].push(contentFilter.body.selector)
    }
  }
  return cssItemsForDomain
}

export const generateContentRulesFiles = async (dir: string, cssItemsForDomain: Record<string, Record<string, string[]>>): Promise<string[]> => {
  await fs.mkdir(dir, { recursive: true })
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
