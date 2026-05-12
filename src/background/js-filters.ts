import { SettingId } from '@src/common/setting-ids'
import { logError } from '@src/common/util'
import { PROCEDURAL_FILTERS_DIR, SCRIPTLETS_DIR } from '@src/common/filter-list-paths'
import { type DisabledSettingCollection } from '@src/common/settings-read'
import { unique } from '@src/common/data-structures'

const fetchLocalFile = async (path: string): Promise<string> => {
  const url = chrome.runtime.getURL(path)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch local file: ${path}: ${response.statusText}`)
  }
  return await response.text()
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

const getId = (dir: string, domain: string): string => {
  return `${dir}/${domain}`
}

const createFilterRule = (dir: string, domain: string, domainsWhereSettingIsDisabled: string[]): chrome.scripting.RegisteredContentScript => {
  const matches = domain === '_default' ? ['*://*/*'] : [`*://${domain}/*`, `*://*.${domain}/*`]
  const excludeMatches = domainsWhereSettingIsDisabled.map(d => [`*://${d}/*`, `*://*.${d}/*`]).flat()
  return {
    allFrames: true,
    id: getId(dir, domain),
    matches,
    excludeMatches,
    runAt: 'document_start' as const,
    world: 'MAIN' as const,
    matchOriginAsFallback: true,
    persistAcrossSessions: true,
    js: [`${dir}/${domain}_.js`]
  }
}

const createFilterRulesForDomain = async (dir: string, domain: string, domainsWhereFiltersAreDisabled: string[]): Promise<chrome.scripting.RegisteredContentScript[]> => {
  const availableDomains = await readIndexFile(dir)
  return unique([domain, '_default'])
    .filter(domainToUpdate => availableDomains.has(domainToUpdate))
    .map(domainToUpdate => createFilterRule(dir, domainToUpdate, domainsWhereFiltersAreDisabled))
}

const createAllFilterRulesForDomain = async (domain: string, domainsWhereFiltersAreDisabled: string[]): Promise<chrome.scripting.RegisteredContentScript[]> => {
  const scriptletRules = await createFilterRulesForDomain(SCRIPTLETS_DIR, domain, domainsWhereFiltersAreDisabled)
  const proceduralRules = await createFilterRulesForDomain(PROCEDURAL_FILTERS_DIR, domain, domainsWhereFiltersAreDisabled)
  return [...scriptletRules, ...proceduralRules]
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

export const createAllFilterRules = async (dir: string, domainsWhereFiltersAreDisabled: string[]): Promise<chrome.scripting.RegisteredContentScript[]> => {
  const availableDomains = await readIndexFile(dir)
  const filterRules: chrome.scripting.RegisteredContentScript[] =
    Array.from(availableDomains).map((domain) => createFilterRule(dir, domain, domainsWhereFiltersAreDisabled))
  return filterRules
}

export const setupAllFilters = async (settings: DisabledSettingCollection): Promise<void> => {
  try {

    const domainsWhereFiltersAreDisabled = unique([...(settings['masterSwitch'] ?? []), ...(settings['ads'] ?? [])])
    const oldFilterRules = await chrome.scripting.getRegisteredContentScripts({})
    const idsToUnregister = oldFilterRules.map(rule => rule.id).filter(id => id.startsWith(PROCEDURAL_FILTERS_DIR) || id.startsWith(SCRIPTLETS_DIR))
    const scriptletRules = await createAllFilterRules(SCRIPTLETS_DIR, domainsWhereFiltersAreDisabled)
    const proceduralRules = await createAllFilterRules(PROCEDURAL_FILTERS_DIR, domainsWhereFiltersAreDisabled)
    const allRules = [...scriptletRules, ...proceduralRules]
    if (idsToUnregister.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: idsToUnregister })
    }
    const t1 = performance.now()
    await chrome.scripting.registerContentScripts(allRules)
    const t2 = performance.now()
    console.log("time to register filters:", t2 - t1)
    const foundFilterRules = await chrome.scripting.getRegisteredContentScripts({})
    console.log("found filters:", foundFilterRules)
  } catch (error) {
    logError(error, 'error setting up filters')
  }
}
