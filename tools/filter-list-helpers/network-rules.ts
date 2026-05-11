type Rule = chrome.declarativeNetRequest.Rule
type RuleAction = chrome.declarativeNetRequest.RuleAction
type RuleCondition = chrome.declarativeNetRequest.RuleCondition
type ResourceType = chrome.declarativeNetRequest.ResourceType
type ResourceTypeValue = `${ResourceType}`
type RequestMethod = chrome.declarativeNetRequest.RequestMethod
type RequestMethodValue = `${RequestMethod}`

export type NetworkRuleWithoutId = Omit<Rule, 'id'>

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

export const isNetworkFilterLine = (line: string): boolean => {
  return !(/##|#@#|#\?#|#@\?#/.test(line))
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
export const parseNetworkFilterLine = (line: string): NetworkRuleWithoutId | undefined => {
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

export const generateBlockingRulesFile = (networkFilters: NetworkRuleWithoutId[]): string => {
  const lines = []
  let id = 0
  for (const networkFilter of networkFilters) {
    ++id
    const rule: Rule = Object.assign({ id }, networkFilter)
    lines.push(JSON.stringify(rule))
  }
  return '[\n' + lines.join(',\n') + ']'
}
