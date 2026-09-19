import { createSafeGetter, createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { SETTING_COOKIE_PREFIX } from '@src/common/setting-ids'

type UnknownRecord = Record<string, unknown>

/** Object keys removed from InnerTube / page JSON when present (ad-related API surface). */
const adKeys = [
  'adPlacements',
  'adSlots',
  'playerAds'
] as const

const AD_KEY_RENAME_TO = 'no_ads'

/** If the URL contains `youtube.com` and any of these substrings, JSON responses may have `adKeys` renamed. */
const SANITIZED_URL_PATH_INCLUDES : string[] = [
  '/youtubei/v1/player',
  '/youtubei/v1/get_watch',
  '/youtubei/v1/reel/reel_watch_sequence'
]

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

/** Walk nested objects/arrays and rename known ad keys to `no_ads`. */
const stripAdsDeep = <T>(value: T): T => {
  if (!isRecord(value)) {
    return value
  }

  const stack: Array<{ node: UnknownRecord; depth: number }> = [{ node: value, depth: 0 }]

  while (stack.length > 0) {
    const current = stack.pop()
    if (current == null) continue
    const { node, depth } = current

    for (const key of adKeys) {
      if (key in node) {
        node[AD_KEY_RENAME_TO] = node[key]
        delete node[key]
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

  return value
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

/** Avoid substring `"ad"` alone — it matches `adaptiveFormats`. */
const textMayContainAdPayload = (text: string): boolean =>
  adKeys.some((key) => text.includes(`"${key}"`))

/** Rename ad keys in the raw JSON text. Does not parse or re-serialize. */
const sanitizeJsonText = (text: string): string => {
  if (!textMayContainAdPayload(text)) {
    return text
  }
  let sanitized = text
  for (const key of adKeys) {
    sanitized = sanitized.replaceAll(`"${key}"`, `"${AD_KEY_RENAME_TO}"`)
  }
  return sanitized
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
        let sanitizedText : string | undefined
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

const isAdsBlockingDisabled = () : boolean => {
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
