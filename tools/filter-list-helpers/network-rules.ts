import { FILTER_LIST_DIR, NETWORK_RULES_FILE, HOSTNAME_RULES_FILE, BLOCKED_HOSTNAMES_JSON_PATH } from '@src/common/filter-list-paths'
import { writeFile, logLineErrors } from './util'
import { mkdir, writeFile as writeFileNode } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Rule = chrome.declarativeNetRequest.Rule
type RuleAction = chrome.declarativeNetRequest.RuleAction
type RuleCondition = chrome.declarativeNetRequest.RuleCondition
type ResourceType = chrome.declarativeNetRequest.ResourceType
type ResourceTypeValue = `${ResourceType}`
type RequestMethod = chrome.declarativeNetRequest.RequestMethod
type RequestMethodValue = `${RequestMethod}`

type NetworkRuleWithoutId = Omit<Rule, 'id'>

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
  'websocket',
  'xhr',
  'method',
  'other'
]

/** Adblock options with no DNR resourceType equivalent. */
const SKIPPED_RESOURCE_TYPES = new Set([
  'popup',
  'generichide',
  'webrtc',
  'csp'
])

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
 * - resourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, websocket, other)
 * - excludedResourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, websocket, other)
 * - requestMethods: one or more of the request methods (get, post, put, delete, options, head, patch, other)
 * - excludedRequestMethods: one or more of the request methods (get, post, put, delete, options, head, patch, other)
 * - initiatorDomains: one or more of the initiator domains
 * - excludedInitiatorDomains: one or more of the initiator domains
 * - cspLine: the CSP line
 *
 * Returns undefined if the filter only specified skipped resource types (e.g. $popup).
 */
const parseTypeOptionsString = (typeOptionsString: string): ParsedTypeOptions | undefined => {
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
  let skippedInclude = false
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
      } else if (!SKIPPED_RESOURCE_TYPES.has(item.substring(1))) {
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
    } else if (SKIPPED_RESOURCE_TYPES.has(item)) {
      skippedInclude = true
    } else {
      resourceTypes.push(toEquivalentResourceType(item))
    }
  }
  if (skippedInclude && resourceTypes.length === 0) {
    return undefined
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
const parseNetworkFilterLine = (line: string): NetworkRuleWithoutId | undefined => {
  const priority = 1
  const type = line.startsWith('@@') ? 'allow' : 'block'
  const action: RuleAction = { type }
  const cleanLine = line.startsWith('@@') ? line.substring(2) : line
  const isRegexFilter = cleanLine.startsWith('/') && cleanLine.endsWith('/')
  if (isRegexFilter) {
    const regexFilter = cleanLine.slice(1, -1)
    // Open-ended counts like .{100,} exceed Chrome's 2KB RE2 compile limit.
    if (/\{\d+,\}/.test(regexFilter)) {
      return undefined
    }
    return { priority, action, condition: { regexFilter } }
  }
  if (cleanLine.includes('$')) {
    const [rawUrlFilter, typeOptionsString] = splitAtFirst(cleanLine, '$')
    const parsed = parseTypeOptionsString(typeOptionsString)
    if (parsed === undefined) {
      return undefined
    }
    const { condition, options } = parsed
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

const deduplicateNetworkFilters = (rules: NetworkRuleWithoutId[]): NetworkRuleWithoutId[] => {
  const seen = new Set<string>()
  return rules.filter(rule => {
    const key = JSON.stringify(rule)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const isUnconditionalBlock = (rule: NetworkRuleWithoutId): boolean => {
  return rule.action.type === 'block' && rule.condition.urlFilter !== undefined && Object.keys(rule.condition).length === 1
}

/** Plain hostname block: block + only urlFilter of the form ||hostname^ */
const isHostnameBlock = (rule: NetworkRuleWithoutId): boolean => {
  if (!isUnconditionalBlock(rule) || rule.condition.urlFilter === undefined) {
    return false
  }
  // Hostname labels: alnum, hyphen, dot (incl. punycode xn--…). No path/query.
  return /^\|\|[a-z0-9.-]+\^$/i.test(rule.condition.urlFilter)
}

// A block whose only condition is a urlFilter already blocks every request that filter matches,
// so another block of that same urlFilter with extra conditions adds nothing.
const removeRedundantNetworkFilters = (rules: NetworkRuleWithoutId[]): NetworkRuleWithoutId[] => {
  const blockedUrlFilters = new Set<string>()
  for (const rule of rules) {
    if (isUnconditionalBlock(rule) && rule.condition.urlFilter !== undefined) {
      blockedUrlFilters.add(rule.condition.urlFilter)
    }
  }
  return rules.filter(rule => {
    if (rule.action.type !== 'block' || isUnconditionalBlock(rule)) {
      return true
    }
    const urlFilter = rule.condition.urlFilter
    return urlFilter === undefined || !blockedUrlFilters.has(urlFilter)
  })
}

const generateNetworkFilterFile = (networkFilters: NetworkRuleWithoutId[]): string => {
  const lines = []
  let id = 0
  for (const networkFilter of networkFilters) {
    ++id
    const rule: Rule = Object.assign({ id }, networkFilter)
    lines.push(JSON.stringify(rule))
  }
  return '[\n' + lines.join(',\n') + ']'
}

/** Strip ||hostname^ → hostname (lowercase). */
const hostnameFromUrlFilter = (urlFilter: string): string => {
  return urlFilter.slice(2, -1).toLowerCase()
}

const writeBlockedHostnamesJson = async (hostnameFilters: NetworkRuleWithoutId[]): Promise<void> => {
  const hostnames = hostnameFilters.map((rule) => hostnameFromUrlFilter(rule.condition.urlFilter!))
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const outPath = path.join(repoRoot, BLOCKED_HOSTNAMES_JSON_PATH)
  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFileNode(outPath, `${JSON.stringify(hostnames)}\n`, 'utf8')
}

export const parseAndGenerateNetworkFilters = async (lines: string[]): Promise<void> => {
  const networkFilters = lines.map(logLineErrors(parseNetworkFilterLine)).filter(networkFilter => networkFilter !== undefined)
  const uniqueNetworkFilters = deduplicateNetworkFilters(networkFilters)
  const necessaryNetworkFilters = removeRedundantNetworkFilters(uniqueNetworkFilters)
  const hostnameFilters: NetworkRuleWithoutId[] = []
  const remainingFilters: NetworkRuleWithoutId[] = []
  for (const rule of necessaryNetworkFilters) {
    if (isHostnameBlock(rule)) {
      hostnameFilters.push(rule)
    } else {
      remainingFilters.push(rule)
    }
  }
  await writeFile(FILTER_LIST_DIR, NETWORK_RULES_FILE, generateNetworkFilterFile(remainingFilters))
  // Hostname DNR ruleset is Chromium-oriented (over Firefox's static DNR budget).
  // Skip the JSON ruleset on Firefox builds; the manifest entry is stripped in copy-src.
  if (process.env.EXTENSION_TARGET !== 'firefox') {
    await writeFile(FILTER_LIST_DIR, HOSTNAME_RULES_FILE, generateNetworkFilterFile(hostnameFilters))
  }
  // Compact hostname string list for Firefox webRequest experiments (bundle or fetch).
  await writeBlockedHostnamesJson(hostnameFilters)
  console.log(
    `network rules: ${remainingFilters.length} general, ${hostnameFilters.length} hostname-only` +
      (process.env.EXTENSION_TARGET === 'firefox' ? ' (hostname DNR file skipped for Firefox)' : '')
  )
  console.log(
    `compact hostname string list generated for Firefox (${hostnameFilters.length} hostnames → ${BLOCKED_HOSTNAMES_JSON_PATH})`
  )
}
