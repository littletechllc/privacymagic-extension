import psl from 'psl'

export const registrableDomainFromUrl = (url: string): string | null =>
  psl.get(new URL(url).hostname)