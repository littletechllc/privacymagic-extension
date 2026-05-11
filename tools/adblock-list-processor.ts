import fs from 'node:fs/promises'
import path from 'node:path'
import { isMain, entries } from './util'
import { fileURLToPath } from 'url'

type Rule = chrome.declarativeNetRequest.Rule
type RuleAction = chrome.declarativeNetRequest.RuleAction
type RuleCondition = chrome.declarativeNetRequest.RuleCondition
type ResourceType = chrome.declarativeNetRequest.ResourceType
type ResourceTypeValue = `${ResourceType}`
type RequestMethod = chrome.declarativeNetRequest.RequestMethod
type RequestMethodValue = `${RequestMethod}`

type NetworkRuleWithoutId = Omit<Rule, 'id'>

type ScriptletInvocation = {
  domains: string[]
  scriptlet: string
}
type ContentFilterBody = {
  style: string
  selector: string
}
type ContentFilter = {
  domains: string[]
  separator: string
  body: ContentFilterBody
}

/** Mirror of chrome.declarativeNetRequest.RequestMethod; Record ensures exhaustiveness. */
const REQUEST_METHOD: Record<RequestMethodValue, RequestMethodValue> = {
  connect: 'connect',
  delete: 'delete',
  get: 'get',
  head: 'head',
  options: 'options',
  patch: 'patch',
  post: 'post',
  put: 'put',
  other: 'other'
}

const VALID_REQUEST_METHODS = new Set(Object.values(REQUEST_METHOD))

const isRequestMethod = (s: string): boolean =>
  VALID_REQUEST_METHODS.has(s as RequestMethodValue)

const __filename = fileURLToPath(import.meta.url)
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
  'csp',
  'other'
]

const RESOURCE_TYPE_EQUIVALENCES: Record<string, ResourceTypeValue> = {
  subdocument: 'sub_frame',
  document: 'main_frame',
  xhr: 'xmlhttprequest'
}

const splitAtFirst = (s: string, separator: string): [string, string] => {
  const index = s.indexOf(separator)
  if (index === -1) {
    return [s, '']
  }
  return [s.substring(0, index), s.substring(index + separator.length)]
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
const toEquivalentResourceType = (raw: string): ResourceTypeValue => {
  if (!ALLOWED_RESOURCE_TYPES.includes(raw)) {
    throw new Error(`Unknown resource type '${raw}'`)
  }
  return RESOURCE_TYPE_EQUIVALENCES[raw] ?? (raw as ResourceTypeValue)
}

const removeEmptyProperties = (obj: Record<string, unknown>): Record<string, unknown> => {
  const newObj = structuredClone(obj)
  for (const [key, value] of Object.entries(newObj)) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newObj[key]
    }
  }
  return newObj
}

type ParsedTypeOptions = {
  condition: RuleCondition,
  options: {
    redirect?: string,
    redirectRule?: boolean | string,
    badFilter?: boolean,
    cspLine?: string
  }
}

/**
 * Parse the given type options string into an object with the following keys:
 * - domainType: the type of domain (firstParty or thirdParty)
 * - resourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, popup, generichide, webrtc, websocket, other)
 * - excludedResourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, popup, generichide, webrtc, websocket, other)
 * - requestMethods: one or more of the request methods (get, post, put, delete, options, head, patch, other)
 * - excludedRequestMethods: one or more of the request methods (get, post, put, delete, options, head, patch, other)
 * - initiatorDomains: one or more of the initiator domains
 * - excludedInitiatorDomains: one or more of the initiator domains
 * - cspLine: the CSP line
 */
const parseTypeOptionsString = (typeOptionsString: string): ParsedTypeOptions => {
  const requestMethods: RequestMethodValue[] = []
  const excludedRequestMethods: RequestMethodValue[] = []
  let domainType : 'firstParty' | 'thirdParty' | undefined = undefined
  let redirect : string | undefined = undefined
  let badFilter : boolean | undefined = undefined
  let redirectRule: boolean | string | undefined = undefined
  const excludedInitiatorDomains: string[] = []
  const initiatorDomains: string[] = []
  const resourceTypes: ResourceTypeValue[] = []
  const excludedResourceTypes: ResourceTypeValue[] = []
  let cspLine: string | undefined = undefined
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
          const m = method.substring(1)
          if (isRequestMethod(m)) {
            excludedRequestMethods.push(m as RequestMethodValue)
          }
        } else {
          if (isRequestMethod(method)) {
            requestMethods.push(method as RequestMethodValue)
          }
        }
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
    } else if (item.startsWith('csp=')) {
      cspLine = item.split('=')[1]
    } else if (item === 'important') {
      console.log('important filter')
      // TODO: handle important filters
      continue
    } else {
      resourceTypes.push(toEquivalentResourceType(item))
    }
  }
  const condition = removeEmptyProperties({
    domainType,
    resourceTypes,
    excludedResourceTypes,
    initiatorDomains,
    excludedInitiatorDomains,
    requestMethods,
    excludedRequestMethods,
  })
  const options = removeEmptyProperties({
    redirect,
    redirectRule,
    badFilter,
    cspLine
  })
  return {
    condition,
    options
  }
}

// Parse the given line into a URL filter and type options
const parseNetworkFilter = (line: string): NetworkRuleWithoutId | undefined => {
  const priority = 1
  const type = line.startsWith('@@') ? 'allow' : 'block'
  const action: RuleAction = { type }
  const cleanLine = line.startsWith('@@') ? line.substring(2) : line
  const isRegexFilter = cleanLine.startsWith('/') && cleanLine.endsWith('/')
  if (isRegexFilter) {
    return { priority, action, condition: { regexFilter: cleanLine } }
  }
  if (cleanLine.includes('$')) {
    const [rawUrlFilter, typeOptionsString] = splitAtFirst(cleanLine, '$')
    const { condition, options } = parseTypeOptionsString(typeOptionsString)
    const urlFilter = rawUrlFilter.trim()
    if (urlFilter.length > 0) {
      condition.urlFilter = urlFilter
    }
    if (options?.badFilter !== undefined) {
      return undefined
    }
    if (options?.redirect !== undefined) {
      return undefined
    }
    if (options?.redirectRule !== undefined) {
      return undefined
    }
    if (options?.cspLine !== undefined) {
      return {
        priority,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [{
            operation: 'set',
            header: 'Content-Security-Policy',
            value: options.cspLine
          }]
        },
        condition
      }
    }
    const result: Omit<Rule, 'id'> = { priority, action, condition }
    return result
  }
  return { priority, action, condition: { urlFilter: cleanLine } }
}

const parseContentFilterBody = (body: string): ContentFilterBody => {
  const matches = body.match(/(.*?):style\((.*?)\)/)
  if (matches !== null && matches !== undefined) {
    return { selector: matches[1], style: matches[2] }
  }
  return { selector: body, style: 'display: none !important;' }
}

const parseContentFilter = (line: string, separator: string): ContentFilter => {
  const [domainsString, body] = line.split(separator)
  // TODO: handle asterisks in domainsString
  const domains = domainsString.split(',').filter(d => !d.endsWith('*'))
  const { selector, style } = parseContentFilterBody(body)
  return { domains, separator, body: { selector, style } }
}

const contentFilterSeparatorRegex = /#\?#|#@#|#S#|##/

type ParsedItem = NetworkRuleWithoutId | ContentFilter | ScriptletInvocation | undefined

type ParsedLine = {
  parsed: ParsedItem
  line: string
}

const constantValueFrom = (value: string): string => {
  switch (value) {
    case 'noopFunc':
      return `(() => {})`
    case 'trueFunc':
      return `(() => true)`
    default:
      return value
  }
}

const setConstantFunction = (path: string, value: unknown): void => {
  const parts = path.split('.');
  let obj: Record<string, unknown> = self as unknown as Record<string, unknown>;
  for (let i: number = 0; i < parts.length - 1; ++i) {
    if (obj[parts[i]] == null) {
      obj[parts[i]] = {};
    }
    obj = obj[parts[i]] as Record<string, unknown>;
  }
  Object.defineProperty(obj, parts[parts.length - 1], {
    get: () => value,
    configurable: false
  });
};

const removeClassFunction = (className: string, selector: string, command?: string): void => {
  const removeClass = (element: Element) => {
    if (element.matches(selector)) {
      element.classList.remove(className)
    }
  }
  const removeClassInTree = (element: Element) => {
    removeClass(element)
    element.querySelectorAll(selector).forEach(removeClass)
  }
  removeClassInTree(document.documentElement)
  if (command?.includes('stay')) {
    const observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof Element) {
              removeClassInTree(node)
            }
          })
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          removeClassInTree(mutation.target as Element)
        }
      })
    })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
  }
}

const generateScriptlet = (scriptletArguments: string[]): string | undefined => {
  const scriptletName = scriptletArguments[0]
  switch (scriptletName) {
    case 'set-cookie':
    case 'set-cookie-reload':
      return `document.cookie = '${scriptletArguments[1]}=${scriptletArguments[2]}; path=/';`
    case 'remove-cookie':
    case 'cookie-remover':
    case 'cookie-remover.js':
      return `document.cookie = '${scriptletArguments[1]}=; path=/';`
    case 'set-local-storage-item':
      return `localStorage.setItem('${scriptletArguments[1]}', '${scriptletArguments[2]}');`
    case 'set-session-storage-item':
      return `sessionStorage.setItem('${scriptletArguments[1]}', '${scriptletArguments[2]}');`
    case 'set':
    case 'set-constant':
      return `(${setConstantFunction.toString()})('${scriptletArguments[1]}', ${constantValueFrom(scriptletArguments[2])});`
    case 'remove-class':
    case 'rc':
      return `(${removeClassFunction.toString()})(${JSON.stringify(scriptletArguments[1])}, ${JSON.stringify(scriptletArguments[2])}, ${JSON.stringify(scriptletArguments[3])});`
    default:
      console.log('unsupported scriptlet', scriptletArguments)
      return undefined
  }
}

const parseScriptletLine = (line: string): ScriptletInvocation | undefined => {
  const matches = line.match(/(.*?)##\+js\((.*?)\)/i)
  if (!Array.isArray(matches) || matches.length < 3) {
    return undefined
  }
  // TODO: handle asterisks in domains
  const domains = matches[1].split(',').filter(d => !d.endsWith('*'))
  const scriptletArguments = matches[2].split(',').map(s => s.trim())
  const scriptlet = generateScriptlet(scriptletArguments)
  if (scriptlet === undefined) {
    return undefined
  }
  return { domains, scriptlet }
}

const parseLine = (line: string): ParsedLine => {
  let parsed: ParsedItem
  try {
    if (line.includes('##+js(')) {
      parsed = parseScriptletLine(line)
    } else {
      // Check if the line is a content filter by looking for a separator
      const separatorMatch = line.match(contentFilterSeparatorRegex)
      if (separatorMatch !== null && separatorMatch !== undefined) {
        parsed = parseContentFilter(line, separatorMatch[0])
      } else {
        parsed = parseNetworkFilter(line)
      }
    }
    return { parsed, line }
  } catch (e: unknown) {
    if (e instanceof Error) {
      e.message = `line '${line}':\n${e.message}`
    } else {
      throw new Error(`line '${line}':\n${String(e)}`)
    }
    throw e
  }
}

export const processLines = (lines: string[]): ParsedLine[] => {
  const codingLines = removeComments(lines).filter(line => line.length > 0)
  return codingLines.map(parseLine)
}

const isBlockingFilter = (parsed: ParsedItem): parsed is NetworkRuleWithoutId => {
  if (parsed === undefined) {
    return false
  }
  return 'condition' in parsed
}

const isContentFilter = (parsed: ParsedItem): parsed is ContentFilter => {
  if (parsed === undefined) {
    return false
  }
  return 'body' in parsed
}

const isScriptletInvocation = (parsed: ParsedItem): parsed is ScriptletInvocation => {
  if (parsed === undefined) {
    return false
  }
  return 'scriptlet' in parsed
}

const generateBlockingRulesFile = (items: ParsedLine[]): string => {
  const lines = []
  let id = 0
  for (const item of items) {
    if (isBlockingFilter(item.parsed)) {
      ++id
      const rule: Rule = Object.assign({ id }, item.parsed)
      lines.push(JSON.stringify(rule))
    }
  }
  return '[\n' + lines.join(',\n') + ']'
}

const generateContentRules = (items: ParsedLine[]): Record<string, Record<string, string[]>> => {
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

const generateScriptletRulesFiles = async (dir: string, items: ParsedLine[]): Promise<void> => {
  await fs.mkdir(dir, { recursive: true })
  const scriptletRules: Record<string, string> = {}
  for (const item of items) {
    if (!isScriptletInvocation(item.parsed)) {
      continue
    }
    const { domains, scriptlet } = item.parsed
    for (const domain of domains) {
      if (scriptletRules[domain] === undefined) {
        scriptletRules[domain] = ''
      }
      scriptletRules[domain] += `${scriptlet}\n`
    }
  }
  for (const [domain, scriptlet] of entries(scriptletRules)) {
    const file = `${domain}_.js`
    await fs.writeFile(path.join(dir, file), scriptlet)
  }
  await fs.writeFile(path.join(dir, 'index.txt'), Object.keys(scriptletRules).sort().join('\n'))
}

const SELECTOR_CHUNK_SIZE = 1024

const generateContentRulesFiles = async (dir: string, cssItemsForDomain: Record<string, Record<string, string[]>>): Promise<string[]> => {
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
  const blockingRulesFileContent = generateBlockingRulesFile(results)
  await fs.mkdir(dist('rules'), { recursive: true })
  await fs.writeFile(dist('rules/easylist.json'),
    blockingRulesFileContent)
  const contentRules = generateContentRules(results)
  const adblockCssDir = dist('content_scripts/adblock_css')
  /* const cssFiles = */await generateContentRulesFiles(adblockCssDir, contentRules)
  await generateScriptletRulesFiles(dist('content_scripts/scriptlets'), results)
}

if (isMain(import.meta)) {
  void processAndWrite()
}
