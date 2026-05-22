import { createSafeGetter, createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { SETTING_COOKIE_PREFIX } from '@src/common/setting-ids'

type UnknownRecord = Record<string, unknown>

/** Object keys removed from InnerTube / page JSON when present (ad-related API surface). */
const adKeys = [
  'ad3Module',
  'adBreakHeartbeatParams',
  'adBreakParams',
  'adBreakServiceRenderer',
  'adLayoutMetadata',
  'adParams',
  'adPlacementRenderer',
  'adPlacements',
  'adSafetyReason',
  'adsControlFlowOpportunityReceivedCommand',
  'adsEngagementPanelContentRenderer',
  'adSlotAndLayoutMetadata',
  'adSlotMetadata',
  'adSlots',
 // 'enabledEngagementPanels',
  'fullerscreenAdPlayerOverlayRenderer',
  'playerAdParams',
  'playerAds',
  'playerLegacyDesktopWatchAdsRenderer',
  'playerOverlayAdRenderer',
  'showCompanionAdUrl',
]

/** If the URL contains `youtube.com` and any of these substrings, JSON responses may be stripped of `adKeys`. */
const SANITIZED_URL_PATH_INCLUDES: string[] = [
  '/youtubei/v1/player',
  '/youtubei/v1/get_watch',
  '/youtubei/v1/reel/reel_watch_sequence',
  '/youtubei/v1/next',
  '/youtubei/v1/browse',
]

const AD_BLOCK_URLS = [
  '/api/stats/ads',
  '/pagead/lvz',
  '/pagead/viewthroughconversion',
]

const ENFORCEMENT_OVERLAY_SELECTORS = [
  'ytd-enforcement-message-view-model',
  'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
  '.ytd-enforcement-message-view-model',
]

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

/** Walk nested objects/arrays and delete known ad keys. Returns total key removals (including nested). */
const stripAdsDeep = (value: unknown): number => {
  if (!isRecord(value)) return 0

  let removedCount = 0
  const stack: Array<{ node: UnknownRecord; depth: number }> = [{ node: value, depth: 0 }]

  while (stack.length > 0) {
    const current = stack.pop()
    if (current == null) continue
    const { node, depth } = current

    for (const key of adKeys) {
      if (key in node) {
        delete node[key]
        removedCount += 1
      }
    }

    for (const nestedValue of Object.values(node)) {
      if (Array.isArray(nestedValue)) {
        const nestedItems = nestedValue as unknown[]
        for (let i = 0; i < nestedItems.length; i += 1) {
          const item = nestedItems[i]
          if (isRecord(item)) {
            stack.push({ node: item, depth: depth + 1 })
          }
        }
        continue
      }
      if (isRecord(nestedValue)) {
        stack.push({ node: nestedValue, depth: depth + 1 })
      }
    }
  }

  return removedCount
}

const ENFORCEMENT_STATUSES = new Set(['UNPLAYABLE', 'ERROR'])

const sanitizePlayabilityStatus = (value: unknown): void => {
  if (!isRecord(value)) return
  const status = value['playabilityStatus']
  if (isRecord(status) && ENFORCEMENT_STATUSES.has(status['status'] as string)) {
    if (isRecord(status['errorScreen']) && 'enforcementMessageViewModel' in status['errorScreen']) {
      delete status['errorScreen']
      status['status'] = 'OK'
    }
  }
  const nested = value['playerResponse']
  if (isRecord(nested)) {
    sanitizePlayabilityStatus(nested)
  }
}

const shouldSanitizeUrlString = (url: string): boolean => {
  if (!url.includes('youtube.com')) {
    return false
  }
  return SANITIZED_URL_PATH_INCLUDES.some((path) => url.includes(path))
}

const shouldSanitizeFetchResponse = (input: RequestInfo | URL): boolean => {
  if (typeof input === 'string') {
    return shouldSanitizeUrlString(input)
  }
  if (input instanceof URL) {
    return shouldSanitizeUrlString(input.href)
  }
  return shouldSanitizeUrlString(input.url)
}

/** Avoid substring `"ad"` alone — it matches `adaptiveFormats` and forces a full parse. */
const textMayContainAdPayload = (text: string): boolean =>
  adKeys.some((key) => text.includes(`"${key}"`))

/** Parse JSON, strip ad keys and fix playability in place, re-serialize. */
const sanitizeJsonText = (text: string): string => {
  const hasAdPayload = textMayContainAdPayload(text)
  const hasUnplayable = text.includes('"UNPLAYABLE"')
  if (!hasAdPayload && !hasUnplayable) {
    return text
  }
  const parsed = JSON.parse(text) as unknown
  if (hasAdPayload) stripAdsDeep(parsed)
  if (hasUnplayable) sanitizePlayabilityStatus(parsed)
  return JSON.stringify(parsed)
}

const patchFetch = (): void => {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (AD_BLOCK_URLS.some((u) => urlString.includes(u))) {
      return new Response('', { status: 200 })
    }
    const response = await originalFetch(input, init)
    if (!shouldSanitizeFetchResponse(input)) {
      return response
    }
    try {
      const text = await response.clone().text()
      const sanitizedText = sanitizeJsonText(text)
      if (sanitizedText === text) {
        return response
      }
      return new Response(sanitizedText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    } catch {
      return response
    }
  }
}

const patchXhr = (): void => {
  const originalOpen = createSafeMethod(XMLHttpRequest, 'open')
  const originalSend = createSafeMethod(XMLHttpRequest, 'send')

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    const parsedUrl = String(url)
    ;(this as XMLHttpRequest & { __pmShouldSanitize?: boolean }).__pmShouldSanitize =
      shouldSanitizeUrlString(parsedUrl)
    originalOpen(this, method, String(url), async ?? true, username, password)
  }

  const xhrGetResponseTextSafe = createSafeGetter(XMLHttpRequest, 'responseText')
  const xhrGetResponseSafe = createSafeGetter(XMLHttpRequest, 'response')
  const xhrGetResponseTypeSafe = createSafeGetter(XMLHttpRequest, 'responseType')

  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: XMLHttpRequestBodyInit | null
  ): void {
    this.addEventListener('readystatechange', function onReadyStateChange() {
      const xhr = this as XMLHttpRequest & { __pmShouldSanitize?: boolean }
      if (xhr.readyState !== 4 || !xhr.__pmShouldSanitize) {
        return
      }
      try {
        let sanitizedText: string | undefined
        Object.defineProperty(xhr, 'responseText', {
          get(this: XMLHttpRequest) {
            const originalResponseText = xhrGetResponseTextSafe(this)
            sanitizedText ??= sanitizeJsonText(originalResponseText)
            return sanitizedText
          },
          configurable: true
        })
        Object.defineProperty(xhr, 'response', {
          get(this: XMLHttpRequest) {
            const originalResponse: unknown = xhrGetResponseSafe(this)
            switch (xhrGetResponseTypeSafe(this)) {
              case 'arraybuffer':
              case 'blob':
              case 'document':
                return originalResponse
              case 'json': {
                stripAdsDeep(originalResponse)
                sanitizePlayabilityStatus(originalResponse)
                return originalResponse
              }
              case '':
              default:
                return sanitizeJsonText(String(originalResponse))
            }
          },
          configurable: true
        })
      } catch {
        // Non-JSON or locked response objects.
      }
    })
    originalSend(this, body)
  }
}

const patchGlobalObjectSetter = (propertyName: 'ytInitialPlayerResponse' | 'ytInitialData'): void => {
  let internalValue: unknown = undefined
  Object.defineProperty(window, propertyName, {
    configurable: true,
    enumerable: true,
    get() {
      return internalValue
    },
    set(value: unknown) {
 //     stripAdsDeep(value)
 //     sanitizePlayabilityStatus(value)
      internalValue = value
    }
  })
}

const sanitizeInitialPlayerResponse = (): void => {
  const initialResponse = (window as Window & { ytInitialPlayerResponse?: unknown }).ytInitialPlayerResponse
  if (initialResponse) {
  //  stripAdsDeep(initialResponse)
//    sanitizePlayabilityStatus(initialResponse)
  }
}

const sanitizeInitialData = (): void => {
  const initialData = (window as Window & { ytInitialData?: unknown }).ytInitialData
  if (initialData) {
    stripAdsDeep(initialData)
  }
}

const removeEnforcementOverlay = (): void => {
  const observer = new MutationObserver(() => {
    for (const selector of ENFORCEMENT_OVERLAY_SELECTORS) {
      document.querySelectorAll(selector).forEach((el) => {
        const popup = el.closest('ytd-popup-container')
        if (popup != null) {
          popup.remove()
        } else {
          el.remove()
        }
      })
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

const isAdsBlockingDisabled = (): boolean => {
  const cookieItems = document.cookie.split(';')
  for (const cookie of cookieItems) {
    const [key, value] = cookie.trim().split('=')
    if (key === `${SETTING_COOKIE_PREFIX}ads` || key === `${SETTING_COOKIE_PREFIX}masterSwitch`) {
      if (value === '0') {
        return true
      }
    }
  }
  return false
}

const main = (): void => {
  patchGlobalObjectSetter('ytInitialPlayerResponse')
  patchGlobalObjectSetter('ytInitialData')
  patchFetch()
  patchXhr()
  sanitizeInitialPlayerResponse()
  sanitizeInitialData()
  removeEnforcementOverlay()
}

if (!isAdsBlockingDisabled()) {
  main()
}