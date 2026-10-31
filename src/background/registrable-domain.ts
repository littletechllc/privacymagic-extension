export const registrableDomainFromUrl = (url: string): string | null => {
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return null
  }
  return chrome.publicSuffix.getDomain(new URL(url).hostname) ?? null
}
