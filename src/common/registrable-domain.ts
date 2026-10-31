/** Punycode eTLD+1 for comparisons and storage. */
export const registrableDomainAscii = (hostname: string): string | null => {
  try {
    return chrome.publicSuffix.getDomain(hostname) ?? null
  } catch {
    return null
  }
}

/** Unicode eTLD+1 for UI labels; lookalike names stay in punycode. */
export const registrableDomainDisplay = (hostname: string): string | null => {
  try {
    return chrome.publicSuffix.getDomain(hostname, { encoding: 'display' }) ?? null
  } catch {
    return null
  }
}

export const registrableDomainAsciiFromUrl = (url: string): string | null => {
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return null
  }
  try {
    return registrableDomainAscii(new URL(url).hostname)
  } catch {
    return null
  }
}
