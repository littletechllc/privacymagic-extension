import { createSafeGetter, createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { SETTING_COOKIE_PREFIX } from '@src/common/setting-ids'

type UnknownRecord = Record<string, unknown>

// Object keys whose array payloads are cleared in InnerTube / page JSON.
const adKeys = [
  'adPlacements',
  'adSlots',
  'playerAds'
] as const

const SANITIZED_URL_PATH_INCLUDES: string[] = [
  '/youtubei/v1/player?',
  '/youtubei/v1/get_watch',
  '/youtubei/v1/reel/reel_watch_sequence'
]

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const VIDEO_ID_RE = /^[\w-]{11}$/
const PLAYABILITY_STATUS_RE = /^[A-Z][A-Z0-9_]*$/
const THUMB_VIDEO_ID_RE = /\/vi\/([\w-]{11})\//
const EXPIRE_PAST_SKEW_SECONDS = 2 * 24 * 60 * 60
const EXPIRE_FUTURE_SKEW_SECONDS = 30 * 24 * 60 * 60

const hasBooleanAdKey = (node: UnknownRecord): boolean =>
  adKeys.some((key) => typeof node[key] === 'boolean')

const playerObjects = (value: unknown): UnknownRecord[] => {
  const out: UnknownRecord[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    if (!isRecord(node)) return
    if ('playabilityStatus' in node || 'videoDetails' in node || 'streamingData' in node) {
      out.push(node)
    }
    if ('playerResponse' in node) visit(node.playerResponse)
  }
  visit(value)
  return out
}

const streamingExpireUnix = (player: UnknownRecord): number | undefined => {
  const streaming = player.streamingData
  if (!isRecord(streaming)) return undefined
  for (const list of [streaming.formats, streaming.adaptiveFormats]) {
    if (!Array.isArray(list)) continue
    for (const format of list) {
      if (!isRecord(format) || typeof format.url !== 'string') continue
      const match = /[?&]expire=(\d+)/.exec(format.url)
      if (match != null) return Number(match[1])
    }
  }
  return undefined
}

const collectWatchVideoIds = (player: UnknownRecord): Set<string> => {
  const ids = new Set<string>()
  const details = isRecord(player.videoDetails) ? player.videoDetails : undefined
  if (typeof details?.videoId === 'string' && VIDEO_ID_RE.test(details.videoId)) {
    ids.add(details.videoId)
  }
  if (isRecord(details?.thumbnail) && Array.isArray(details.thumbnail.thumbnails)) {
    for (const thumb of details.thumbnail.thumbnails) {
      if (!isRecord(thumb) || typeof thumb.url !== 'string') continue
      const match = THUMB_VIDEO_ID_RE.exec(thumb.url)
      if (match != null) ids.add(match[1])
    }
  }
  return ids
}

const isBaitPlayer = (player: UnknownRecord): boolean => {
  if (hasBooleanAdKey(player)) return true
  const details = isRecord(player.videoDetails) ? player.videoDetails : undefined
  if (typeof details?.videoId === 'string' && !VIDEO_ID_RE.test(details.videoId)) {
    return true
  }
  const playability = isRecord(player.playabilityStatus) ? player.playabilityStatus : undefined
  if (typeof playability?.status === 'string' && !PLAYABILITY_STATUS_RE.test(playability.status)) {
    return true
  }
  const responseContext = isRecord(player.responseContext) ? player.responseContext : undefined
  const mainApp = isRecord(responseContext?.mainAppWebResponseContext)
    ? responseContext.mainAppWebResponseContext
    : undefined
  if (mainApp != null && 'loggedOut' in mainApp && typeof mainApp.loggedOut !== 'boolean') {
    return true
  }
  const expire = streamingExpireUnix(player)
  if (expire != null) {
    const delta = expire - Date.now() / 1000
    if (delta < -EXPIRE_PAST_SKEW_SECONDS || delta > EXPIRE_FUTURE_SKEW_SECONDS) {
      return true
    }
  }
  return collectWatchVideoIds(player).size > 1
}

const isBaitPayload = (value: unknown): boolean => {
  if (isRecord(value) && hasBooleanAdKey(value)) return true
  return playerObjects(value).some(isBaitPlayer)
}

const stripAdsDeep = <T>(value: T): T => {
  if (!isRecord(value) || isBaitPayload(value)) {
    return value
  }

  const stack: UnknownRecord[] = [value]

  while (stack.length > 0) {
    const node = stack.pop()
    if (node == null) continue

    for (const key of adKeys) {
      if (key in node && Array.isArray(node[key])) {
        node[key] = []
      }
    }

    for (const nestedValue of Object.values(node)) {
      if (Array.isArray(nestedValue)) {
        for (const item of nestedValue) {
          if (isRecord(item)) stack.push(item)
        }
        continue
      }
      if (isRecord(nestedValue)) {
        stack.push(nestedValue)
      }
    }
  }

  return value
}

const shouldSanitizeUrlString = (url: string): boolean => {
  if (url.includes('://') && !url.includes('youtube.com')) {
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

const textMayContainAdPayload = (text: string): boolean =>
  adKeys.some((key) => text.includes(`"${key}"`))

const sanitizeJsonText = (text: string): string => {
  if (!textMayContainAdPayload(text)) {
    return text
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (isBaitPayload(parsed)) {
      return text
    }
    stripAdsDeep(parsed)
    return JSON.stringify(parsed)
  } catch {
    return text
  }
}

const patchFetch = (): void => {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
      const headers = new Headers(response.headers)
      headers.delete('content-length')
      headers.delete('content-encoding')
      const responseCopy = new Response(sanitizedText, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
      for (const key of ['url', 'type', 'redirected'] as const) {
        Object.defineProperty(responseCopy, key, { value: response[key] })
      }
      return responseCopy
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
        Object.defineProperty(xhr, 'responseText',
           {
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
              case 'json':
                return stripAdsDeep(originalResponse)
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

const patchInitialPlayerResponseSetter = (): void => {
  let internalValue: unknown = undefined
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    configurable: true,
    enumerable: true,
    get() {
      return internalValue
    },
    set(value: unknown) {
      stripAdsDeep(value)
      internalValue = value
    }
  })
}

const sanitizeInitialPlayerResponse = (): void => {
  const initialResponse = (window as Window & { ytInitialPlayerResponse?: unknown }).ytInitialPlayerResponse
  if (initialResponse) {
    stripAdsDeep(initialResponse)
  }
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
  patchInitialPlayerResponseSetter()
  patchFetch()
  patchXhr()
  sanitizeInitialPlayerResponse()
}

if (!isAdsBlockingDisabled()) {
  main()
}
