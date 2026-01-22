import psl from 'psl'

export const registrableDomainFromUrl = (url: string): string | null =>
  psl.get(new URL(url).hostname)

export const logError = (error: unknown, message: string, details?: unknown): void => {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  console.error('Error:', `'${message}'`, `'${errorObj.name}'`, `'${errorObj.message}'`, details, errorObj.stack)
}

// Safely call async functions in event listeners.
export const handleAsync = (fn: () => Promise<void>, onError?: (error: unknown) => void): void => {
  void fn().catch((error) => {
    if (onError !== undefined) {
      onError(error)
    } else {
      logError(error, 'error in async event handler')
    }
  })
}

export const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] =
  Object.values(chrome.declarativeNetRequest.ResourceType)
