type ResourceTypeName = `${chrome.declarativeNetRequest.ResourceType}`

// Fails to compile — and names the missing type(s) — if any ResourceType is left out
const allResourceTypes = <const T extends readonly ResourceTypeName[]>(
  types: Exclude<ResourceTypeName, T[number]> extends never ? T : Exclude<ResourceTypeName, T[number]>[]
) => [...types] as chrome.declarativeNetRequest.ResourceType[]

export const ALL_RESOURCE_TYPES = allResourceTypes([
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
