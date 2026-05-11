import { SettingId } from '@src/common/setting-ids'
import { logError } from '@src/common/util'
import { SCRIPTLETS_DIR } from '@src/common/filter-list-paths'

const WILDCARD_MATCH = '*://*/*'
const SCRIPTLET_ID_PREFIX = 'scriptlet-'

const fetchLocalFile = async (path: string): Promise<string> => {
  const url = chrome.runtime.getURL(path)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch local file: ${path}: ${response.statusText}`)
  }
  return await response.text()
}

export const updateScriptlet = async (domain: string, settingId: SettingId, disabled: boolean): Promise<void> => {
  if (settingId !== 'masterSwitch' && settingId !== 'ads') {
    return
  }
  const id = `${SCRIPTLET_ID_PREFIX}${domain}`
  const rules = await chrome.scripting.getRegisteredContentScripts({ ids: [id] })
  if (rules.length === 0) {
    return
  }
  const rule = rules[0]
  // To disable a scriptlet, we make sure it never matches.
  rule.excludeMatches = disabled ? [WILDCARD_MATCH] : []
  await chrome.scripting.updateContentScripts([rule])
  const rulesFound = await chrome.scripting.getRegisteredContentScripts({ ids: [id] })
  console.log("toggle scriptlet:", id, disabled ? "disabled" : "enabled", rulesFound)
}

export const setupScriptlets = async (): Promise<void> => {
  try {
    const scriptletList = await fetchLocalFile(`${SCRIPTLETS_DIR}/index.txt`)
    const scriptletListLines = scriptletList.split('\n')
    const scriptletRules: chrome.scripting.RegisteredContentScript[] =
      scriptletListLines.map((domain) => ({
        allFrames: true,
        id: `${SCRIPTLET_ID_PREFIX}${domain}`,
        matches: [`*://${domain}/*`, `*://*.${domain}/*`],
        js: [`${SCRIPTLETS_DIR}/${domain}_.js`],
        runAt: 'document_start',
        world: 'MAIN',
        matchOriginAsFallback: true,
        persistAcrossSessions: true,
      }))
    const oldScriptletRules = await chrome.scripting.getRegisteredContentScripts({})
    const idsToUnregister = oldScriptletRules.map(rule => rule.id).filter(id => id.startsWith(SCRIPTLET_ID_PREFIX))
    if (idsToUnregister.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: idsToUnregister })
    }
    await chrome.scripting.registerContentScripts(scriptletRules)
    const foundScriptletRules = await chrome.scripting.getRegisteredContentScripts({})
    console.log("found scripts:", foundScriptletRules)
  } catch (error) {
    logError(error, 'error setting up scriptlets')
  }
}