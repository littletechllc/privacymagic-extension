import { SettingId } from '@src/common/setting-ids'
import { logError } from '@src/common/util'
import { COSMETIC_FILTERS_DIR, PROCEDURAL_FILTERS_DIR, SCRIPTLETS_DIR } from '@src/common/filter-list-paths'
import { type DisabledSettingCollection } from '@src/common/settings-read'
import { unique } from '@src/common/data-structures'

type InjectionType = 'js' | 'css'

const fetchLocalFile = async (path: string): Promise<string> => {
  const url = chrome.runtime.getURL(path)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch local file: ${path}: ${response.statusText}`)
  }
  return await response.text()
}

const getId = (dir: string, domain: string): string => {
  return `${dir}/${domain}`
}

const indexFileCache = new Map<string, Promise<Set<string>>>()

const readIndexFile = async (dir: string): Promise<Set<string>> => {
  if (!indexFileCache.has(dir)) {
    indexFileCache.set(dir, fetchLocalFile(`${dir}/index.txt`).then(indexFile => {
      const domains = indexFile.split('\n')
      return new Set(domains.map(domain => domain.trim()).filter(domain => domain !== ''))
    }))
  }
  return await indexFileCache.get(dir)!
}

const createFilterRule = (dir: string, domain: string, injectionType: InjectionType, domainsWhereSettingIsDisabled: string[]): chrome.scripting.RegisteredContentScript => {
  const matches = domain === '_default' ? ['*://*/*'] : [`*://${domain}/*`, `*://*.${domain}/*`]
  const excludeMatches = domainsWhereSettingIsDisabled.map(d => [`*://${d}/*`, `*://*.${d}/*`]).flat()
  const baseRule = {
    allFrames: true,
    id: getId(dir, domain),
    matches,
    excludeMatches,
    runAt: 'document_start' as const,
    world: 'MAIN' as const,
    matchOriginAsFallback: true,
    persistAcrossSessions: true,
  }
  return injectionType === 'js' ? { ...baseRule, js: [`${dir}/${domain}_.js`] } : { ...baseRule, css: [`${dir}/${domain}_.css`]  }
}

const createFilterRulesForDomain = async (dir: string, domain: string, injectionType: InjectionType, domainsWhereFiltersAreDisabled: string[]): Promise<chrome.scripting.RegisteredContentScript[]> => {
  const availableDomains = await readIndexFile(dir)
  return unique([domain, '_default'])
    .filter(domainToUpdate => availableDomains.has(domainToUpdate))
    .map(domainToUpdate => createFilterRule(dir, domainToUpdate, injectionType, domainsWhereFiltersAreDisabled))
}

const createAllFilterRulesForDomain = async (domain: string, domainsWhereFiltersAreDisabled: string[]): Promise<chrome.scripting.RegisteredContentScript[]> => {
  const scriptletRules = await createFilterRulesForDomain(SCRIPTLETS_DIR, domain, 'js', domainsWhereFiltersAreDisabled)
  const cosmeticRules = await createFilterRulesForDomain(COSMETIC_FILTERS_DIR, domain, 'css', domainsWhereFiltersAreDisabled)
  const proceduralRules = await createFilterRulesForDomain(PROCEDURAL_FILTERS_DIR, domain, 'js', domainsWhereFiltersAreDisabled)
  return [...scriptletRules, ...cosmeticRules, ...proceduralRules]
}

export const updateAllFilters = async (settingId: SettingId, domain: string, domainsWhereFiltersAreDisabled: string[]): Promise<void> => {
  if (settingId !== 'masterSwitch' && settingId !== 'ads') {
    return
  }
  const rules = await createAllFilterRulesForDomain(domain, domainsWhereFiltersAreDisabled)
  if (rules.length > 0) {
    await chrome.scripting.updateContentScripts(rules)
  }
}

export const createAllFilterRules = async (dir: string, injectionType: 'js' | 'css', domainsWhereFiltersAreDisabled: string[]): Promise<chrome.scripting.RegisteredContentScript[]> => {
  const availableDomains = await readIndexFile(dir)
  const filterRules: chrome.scripting.RegisteredContentScript[] =
    Array.from(availableDomains).map((domain) => createFilterRule(dir, domain, injectionType, domainsWhereFiltersAreDisabled))
  return filterRules
}

export const setupAllFilters = async (settings: DisabledSettingCollection): Promise<void> => {
  try {

    const domainsWhereFiltersAreDisabled = unique([...(settings['masterSwitch'] ?? []), ...(settings['ads'] ?? [])])
    const oldFilterRules = await chrome.scripting.getRegisteredContentScripts({})
    const idsToUnregister = oldFilterRules.map(rule => rule.id).filter(id => id.startsWith(COSMETIC_FILTERS_DIR) || id.startsWith(PROCEDURAL_FILTERS_DIR) || id.startsWith(SCRIPTLETS_DIR))
    const scriptletRules = await createAllFilterRules(SCRIPTLETS_DIR, 'js', domainsWhereFiltersAreDisabled)
    const cosmeticRules = await createAllFilterRules(COSMETIC_FILTERS_DIR, 'css', domainsWhereFiltersAreDisabled)
    const proceduralRules = await createAllFilterRules(PROCEDURAL_FILTERS_DIR, 'js', domainsWhereFiltersAreDisabled)
    const allRules = [...scriptletRules, ...cosmeticRules, ...proceduralRules]
    if (idsToUnregister.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: idsToUnregister })
    }
    await chrome.scripting.registerContentScripts(allRules)
    const foundFilterRules = await chrome.scripting.getRegisteredContentScripts({})
    console.log("found filters:", foundFilterRules)
  } catch (error) {
    logError(error, 'error setting up filters')
  }
}