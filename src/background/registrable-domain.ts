import { get } from 'psl'

export const registrableDomainFromUrl = (url: string): string | null =>
  get(new URL(url).hostname)