/**
 * Firefox MV3 hostname blocking via blocking webRequest.
 * Mirrors Adblock ||hostname^ semantics: host or any parent domain in the set.
 * Top-level navigations (main_frame) are not cancelled.
 */

/** All webRequest types except main_frame (top-level document loads). */
const NON_MAIN_FRAME_TYPES: Array<`${chrome.webRequest.ResourceType}`> = [
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
  'webbundle',
  'other'
]

/** True if hostname or any parent domain is in the block set (||example.com^ style). */
export const hostnameOrAncestorIsBlocked = (hostname: string, blocked: Set<string>): boolean => {
  let host = hostname.toLowerCase()
  if (host.endsWith('.')) {
    host = host.slice(0, -1)
  }
  while (host !== '') {
    if (blocked.has(host)) {
      return true
    }
    const dot = host.indexOf('.')
    if (dot === -1) {
      return false
    }
    host = host.slice(dot + 1)
  }
  return false
}

const hostnameFromRequestUrl = (url: string): string | null => {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export const startFirefoxHostnameBlocking = (blockedHostnames: Set<string>): void => {
  chrome.webRequest.onBeforeRequest.addListener(
    (details): chrome.webRequest.BlockingResponse | undefined => {
      const hostname = hostnameFromRequestUrl(details.url)
      if (hostname == null) {
        return undefined
      }
      if (hostnameOrAncestorIsBlocked(hostname, blockedHostnames)) {
        return { cancel: true }
      }
      return undefined
    },
    { urls: ['<all_urls>'], types: NON_MAIN_FRAME_TYPES },
    ['blocking']
  )
  console.log('Firefox hostname webRequest blocking listener registered')
}
