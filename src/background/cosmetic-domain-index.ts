import { logError } from '@src/common/util'
import { COSMETIC_FILTERS_DIR } from '@src/common/filter-list-paths'

const COSMETIC_DOMAIN_INDEX_PATH = `${COSMETIC_FILTERS_DIR}/index.txt`
const COSMETIC_DOMAIN_INDEX_CACHE_KEY = 'cosmeticDomainIndex'

let cosmeticDomainIndex: Promise<Set<string>> | undefined

const parseCosmeticDomainIndex = (text: string): string[] =>
  text.split('\n').filter((line) => line.length > 0)

const fetchCosmeticDomainIndex = async (): Promise<string[]> => {
  const url = chrome.runtime.getURL(COSMETIC_DOMAIN_INDEX_PATH)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('failed to fetch cosmetic domain index')
  }
  const text = await response.text()
  if (text.length === 0) {
    throw new Error('cosmetic domain index is empty')
  }
  return parseCosmeticDomainIndex(text)
}

const readCosmeticDomainIndex = async (): Promise<Set<string>> => {
  try {
    const stored = await chrome.storage.session.get(COSMETIC_DOMAIN_INDEX_CACHE_KEY)
    const cachedDomains = stored[COSMETIC_DOMAIN_INDEX_CACHE_KEY] as string[] | undefined
    if (cachedDomains !== undefined && cachedDomains.length > 0) {
      return new Set(cachedDomains)
    }
    const newDomains = await fetchCosmeticDomainIndex()
    void chrome.storage.session.set({
      [COSMETIC_DOMAIN_INDEX_CACHE_KEY]: newDomains
    }).catch((error: unknown) => {
      logError(error, 'error caching cosmetic domain index')
    })
    return new Set(newDomains)
  } catch (error) {
    logError(error, 'error loading cosmetic domain index')
    return new Set()
  }
}

export const loadCosmeticDomainIndex = (): Promise<Set<string>> => {
  cosmeticDomainIndex ??= readCosmeticDomainIndex()
  return cosmeticDomainIndex
}

export const cosmeticFilterExistsForDomain = async (domain: string): Promise<boolean> => {
  const index = await loadCosmeticDomainIndex()
  return index.has(domain)
}
