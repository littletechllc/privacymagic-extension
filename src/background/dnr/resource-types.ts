import { browserInfo } from '@src/common/browser'

type ResourceTypeName = `${chrome.declarativeNetRequest.ResourceType}`

// Fails to compile (and names the missing types) if any ResourceType is left out
const allResourceTypes = <const T extends readonly ResourceTypeName[]>(
  types: Exclude<ResourceTypeName, T[number]> extends never ? T : Exclude<ResourceTypeName, T[number]>[]
): chrome.declarativeNetRequest.ResourceType[] =>
  [...types] as chrome.declarativeNetRequest.ResourceType[]

const CHROME_ALL_RESOURCE_TYPES = allResourceTypes([
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'webtransport',
  'webbundle',
  'other'
])

/**
 * Firefox and Safari reject these names and fail the whole updateDynamicRules batch.
 * Neither browser classifies requests as these types.
 */
const NON_CHROMIUM_UNSUPPORTED_RESOURCE_TYPES = new Set<string>([
  'webtransport',
  'webbundle',
] satisfies readonly ResourceTypeName[])

export const resourceTypesForBrowser = (isChromium: boolean): chrome.declarativeNetRequest.ResourceType[] =>
  isChromium
    ? CHROME_ALL_RESOURCE_TYPES
    : CHROME_ALL_RESOURCE_TYPES.filter(type => !NON_CHROMIUM_UNSUPPORTED_RESOURCE_TYPES.has(type))

export const ALL_RESOURCE_TYPES = resourceTypesForBrowser(browserInfo.isChromium)
