import { get as getRegistrableDomain } from 'psl'

export const registrableDomainFromUrl = (url: string): string | null => {
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return null
  }
  return getRegistrableDomain(new URL(url).hostname)
}