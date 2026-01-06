import fs from 'node:fs/promises'
import path from 'node:path'
import { isMain, entries } from './util'
import { fileURLToPath } from 'url'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url)
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename)

const BLOCKLISTS: string[] = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt'
]

const ALLOWED_RESOURCE_TYPES: string[] = [
  'subdocument',
  'document',
  'stylesheet',
  'image',
  'script',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'media',
  'popup',
  'generichide',
  'webrtc',
  'websocket',
  'xhr',
  'method',
  'other'
]

const RESOURCE_TYPE_EQUIVALENCES: Record<string, string> = {
  subdocument: 'sub_frame',
  document: 'main_frame',
  xhr: 'xmlhttprequest'
}

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

// Convert the given resource type from the adblock list to
// its Chrome extension equivalent
const toEquivalentResourceType = (raw: string): string => {
  if (!ALLOWED_RESOURCE_TYPES.includes(raw)) {
    throw new Error(`Unknown resource type '${raw}'`)
  }
  return RESOURCE_TYPE_EQUIVALENCES[raw] ?? raw
}

interface FilterOptions {
  domainType: string
  resourceTypes: string[]
  excludedResourceTypes: string[]
  initiatorDomains: string[]
  excludedInitiatorDomains: string[]
  requestMethods: string[]
  excludedRequestMethods: string[]
  cspLine: string
  redirect: string
  redirectRule: boolean | string
  badFilter: boolean
}

// Parse the given type options string into an object with the following keys:
// - domainType: the type of domain (firstParty or thirdParty)
// - resourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, popup, generichide, webrtc, websocket, other)
// - excludedResourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, popup, generichide, webrtc, websocket, other)
// - excludedInitiatorDomains: one or more domain names or wildcard domain names
// - initiatorDomains: one or more domain names or wildcard domain names
// - requestMethods: one or more request methods ("connect", "delete", "get", "head", "options", "patch", "post", "put", "other")
// - excludedRequestMethods: one or more request methods ("connect", "delete", "get", "head", "options", "patch", "post", "put", "other")
// - cspLine: the CSP line
// - redirect
const typeOptionsStringToLists = (typeOptionsString: string): FilterOptions => {
  const resourceTypes = []
  const excludedResourceTypes = []
  const initiatorDomains = []
  const excludedInitiatorDomains = []
  const requestMethods = []
  const excludedRequestMethods = []
  let domainType = ''
  let cspLine = ''
  let redirect = ''
  let badFilter = false
  let redirectRule: boolean | string = false
  const items = typeOptionsString.split(',')
  for (const item of items) {
    if (item.startsWith('domain=')) {
      const domains = item.split('=')[1].split('|')
      for (const domain of domains) {
        if (domain.startsWith('~')) {
          excludedInitiatorDomains.push(domain.substring(1))
        } else {
          initiatorDomains.push(domain)
        }
      }
    } else if (item.startsWith('method=')) {
      const methods = item.split('=')[1].split('|')
      for (const method of methods) {
        if (method.startsWith('~')) {
          excludedRequestMethods.push(method.substring(1))
        } else {
          requestMethods.push(method)
        }
      }
    } else if (item.startsWith('csp')) {
      if (item.startsWith('csp=')) {
        cspLine = item.split('=')[1]
      } else {
        cspLine = ''
      }
    } else if (item.startsWith('redirect=')) {
      redirect = item.split('=')[1]
    } else if (item.startsWith('redirect-rule')) {
      if (item.startsWith('redirect-rule=')) {
        redirectRule = item.split('=')[1]
      } else {
        redirectRule = true
      }
    } else if (item.startsWith('~')) {
      if (item === '~third-party') {
        domainType = 'firstParty'
      } else {
        excludedResourceTypes.push(toEquivalentResourceType(item.substring(1)))
      }
    } else if (item === 'third-party') {
      domainType = 'thirdParty'
    } else if (item === 'badfilter') {
      badFilter = true
    } else if (item === 'important') {
      console.log('important filter')
      // TODO: handle important filters
      continue
    } else {
      resourceTypes.push(toEquivalentResourceType(item))
    }
  }
  return {
    domainType,
    resourceTypes,
    excludedResourceTypes,
    initiatorDomains,
    excludedInitiatorDomains,
    requestMethods,
    excludedRequestMethods,
    cspLine,
    redirect,
    redirectRule,
    badFilter
  }
}

interface UrlFilter {
  urlFilter: string
  filterOptions?: FilterOptions
}

// Parse the given line into a URL filter and type options
const lineToUrlFilter = (line: string): UrlFilter => {
  if (line.includes('$')) {
    const [urlFilter, typeOptionsString] = line.split('$')
    return { urlFilter, filterOptions: typeOptionsStringToLists(typeOptionsString) }
  }
  return { urlFilter: line }
}

interface BlockingFilter {
  priority: number
  action: {
    type: string
  }
  condition: UrlFilter | { regexFilter: string }
}

const parseBlockingFilter = (line: string): BlockingFilter => {
  const isRegexFilter = line.startsWith('/') && line.endsWith('/')
  const type = line.startsWith('@@') ? 'allow' : 'block'
  const cleanLine = line.startsWith('@@') ? line.substring(2) : line
  const condition = isRegexFilter
    ? { regexFilter: cleanLine }
    : lineToUrlFilter(cleanLine)
  return { priority: 1, action: { type }, condition }
}

interface ContentFilterBody {
  style: string
  selector: string
}

const parseContentFilterBody = (body: string): ContentFilterBody => {
  const matches = body.match(/(.*?):style\((.*?)\)/)
  if (matches != null) {
    return { selector: matches[1], style: matches[2] }
  }
  return { selector: body, style: 'display: none !important;' }
}

interface ContentFilter {
  domains: string[]
  separator: string
  body: ContentFilterBody
}

const parseContentFilter = (line: string, separator: string): ContentFilter => {
  const [domainsString, body] = line.split(separator)
  // TODO: handle asterisks in domainsString
  const domains = domainsString.split(',').filter(d => !d.endsWith('*'))
  const { selector, style } = parseContentFilterBody(body)
  return { domains, separator, body: { selector, style } }
}

const contentFilterSeparatorRegex = /#\?#|#@#|#S#|##/

interface Line {
  parsed: BlockingFilter | ContentFilter
  line: string
}

const isBlockingFilter = (parsed: BlockingFilter | ContentFilter): parsed is BlockingFilter => {
  return 'condition' in parsed
}

const isContentFilter = (parsed: BlockingFilter | ContentFilter): parsed is ContentFilter => {
  return 'domains' in parsed
}

const parseLine = (line: string): Line => {
  let parsed: BlockingFilter | ContentFilter
  try {
    // Check if the line is a content filter by looking for a separator
    const separatorMatch = line.match(contentFilterSeparatorRegex)
    if (separatorMatch != null) {
      parsed = parseContentFilter(line, separatorMatch[0])
    } else {
      parsed = parseBlockingFilter(line)
    }
    return { parsed, line }
  } catch (e: any) {
    if (e instanceof Error) {
      e.message = `line '${line}':\n` + e.message
    } else {
      throw new Error(`line '${line}':\n${String(e)}`)
    }
    throw e
  }
}

export const processLines = (lines: string[]): Line[] => {
  const codingLines = removeComments(lines).filter(line => line.length > 0)
  return codingLines.map(parseLine)
}

const generateBlockingRulesFile = (items: Line[]): string => {
  const lines = []
  let id = 0
  for (const item of items) {
    if (isBlockingFilter(item.parsed)) {
      ++id
      lines.push(JSON.stringify(Object.assign({ id }, item.parsed)))
    }
  }
  return '[\n' + lines.join(',\n') + ']'
}

const generateContentRules = (items: Line[]): Record<string, Record<string, string[]>> => {
  const cssItemsForDomain: Record<string, Record<string, string[]>> = {}
  for (const item of items) {
    if (!isContentFilter(item.parsed)) {
      continue
    }
    const parsed = item.parsed
    if (parsed.separator !== '##') {
      // TODO: handle other separators
      console.log('skipping non-## separator', parsed)
      continue
    }
    if (parsed.body.selector.includes('has-text') || parsed.body.selector.startsWith('+js(')) {
      console.log('skipping odd selector', parsed)
      continue
    }
    for (const domain of parsed.domains) {
      cssItemsForDomain[domain] ||= {}
      cssItemsForDomain[domain][parsed.body.style] ||= []
      cssItemsForDomain[domain][parsed.body.style].push(parsed.body.selector)
    }
  }
  return cssItemsForDomain
}

const SELECTOR_CHUNK_SIZE = 1024

const generateContentRulesFiles = async (dir: string, cssItemsForDomain: Record<string, any>): Promise<string[]> => {
  await fs.mkdir(dir, { recursive: true })
  const files = []
  for (const [domain, cssItems] of entries(cssItemsForDomain)) {
    const lines = []
    for (const [style, selectors] of entries(cssItems)) {
      const selectorsSorted = (selectors as string[]).sort()
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
  const results = processLines(linesFiltered)
  const results2 = results.filter(x => {
    if (!isBlockingFilter(x.parsed)) return true
    const condition = x.parsed.condition
    if ('regexFilter' in condition) return true
    return condition.filterOptions?.resourceTypes?.includes('popup') !== true
  })
  const blockingRulesFileContent = generateBlockingRulesFile(results2)
  await fs.mkdir(dist('rules'), { recursive: true })
  await fs.writeFile(dist('rules/easylist.json'),
    blockingRulesFileContent)
  const contentRules = generateContentRules(results2)
  const adblockCssDir = dist('content_scripts/adblock_css')
  /* const cssFiles = */await generateContentRulesFiles(adblockCssDir, contentRules)
}

if (isMain(import.meta)) {
  console.log(path)
  void processAndWrite()
}
