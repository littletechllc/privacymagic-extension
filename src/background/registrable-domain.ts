import { get as getRegistrableDomain } from 'psl'

export const registrableDomainFromUrl = (url: string): string | null =>
  getRegistrableDomain(new URL(url).hostname)