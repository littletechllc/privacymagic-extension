import { registrableDomainFromUrl, logError } from '../common/util'
import { getAllSettings } from '../common/settings'
import { IDS } from './ids'

const disabledSettingsForDomain = new Map<string, string[]>()

const cacheDisabledSettingsForDomain = (domain: string, settingId: string, value: boolean): void => {
  const existing = disabledSettingsForDomain.get(domain) ?? []
  if (!value) {
    existing.push(settingId)
    disabledSettingsForDomain.set(domain, existing)
  } else {
    const filtered = existing.filter(s => s !== settingId)
    if (filtered.length === 0) {
      disabledSettingsForDomain.delete(domain)
    } else {
      disabledSettingsForDomain.set(domain, filtered)
    }
  }
}

const getDisabledSettingsForDomain = (domain: string): string[] => {
  return disabledSettingsForDomain.get(domain) ?? []
}

// Create a rule that adds a Set-Cookie header to the response
// that contains the disabled settings for the domain. The content
// script will then read the Set-Cookie header, apply the disabled
// settings in the frame context, and delete the cookie so it is
// not visible to page scripts or sent to the server.
const createActionForSettings = (disabledSettings: string[]): chrome.declarativeNetRequest.RuleAction => {
  const cookieKeyVal = `__pm__disabled_settings = ${disabledSettings.join(',')}`
  const headerValue = `${cookieKeyVal}; Secure; SameSite=None; Path=/; Partitioned`
  return {
    type: 'modifyHeaders',
    responseHeaders: [
      { operation: 'append', header: 'Set-Cookie', value: headerValue }
    ]
  }
}

const createRuleForDomain = (domain: string, disabledSettings: string[]): chrome.declarativeNetRequest.Rule => {
  const action = createActionForSettings(disabledSettings)
  return {
    id: IDS.CONTENT_SCRIPTS_TOP_LEVEL_RULE_ID,
    priority: 5,
    action,
    condition: {
      urlFilter: `||${domain}/`,
      resourceTypes: ['main_frame']
    }
  }
}

const createRuleForTab = (tabId: number, disabledSettings: string[]): chrome.declarativeNetRequest.Rule => {
  const action = createActionForSettings(disabledSettings)
  return {
    id: IDS.CONTENT_SCRIPTS_SUBRESOURCE_RULE_ID,
    priority: 5,
    action,
    condition: {
      tabIds: [tabId],
      resourceTypes: ['sub_frame']
    }
  }
}

const applyDisabledSettingsForTabs = (): void => {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    try {
      const domain = registrableDomainFromUrl(details.url)
      if (domain === null) {
        return
      }
      const disabledSettings = getDisabledSettingsForDomain(domain)
      const rule = createRuleForTab(details.tabId, disabledSettings)
      chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] }).catch(error => {
        logError(error, 'error applying disabled settings for tabs', details)
      })
    } catch (error) {
      logError(error, 'error applying disabled settings for tabs', details)
    }
  })
}

export const updateContentScripts = async (domain: string, settingId: string, value: boolean): Promise<void> => {
  cacheDisabledSettingsForDomain(domain, settingId, value)
  const rule = createRuleForDomain(domain, getDisabledSettingsForDomain(domain))
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] })
}

const initializeContentScripts = async (): Promise<void> => {
  const settings = await getAllSettings()
  for (const [domain, settingId, value] of settings) {
    await updateContentScripts(domain, settingId, value)
  }
}

export const setupContentScripts = async (): Promise<void> => {
  // Unregister any existing content script with this ID to avoid duplicates
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ['foreground', 'isolated'] })
  } catch {
    // Ignore error if script doesn't exist
  }
  const mainForegroundRule: chrome.scripting.RegisteredContentScript = {
    matchOriginAsFallback: true,
    persistAcrossSessions: false,
    runAt: 'document_start',
    allFrames: true,
    id: 'foreground',
    js: ['content_scripts/main.js'],
    matches: ['<all_urls>'],
    world: 'MAIN'
  }
  const isolatedRule: chrome.scripting.RegisteredContentScript = {
    matchOriginAsFallback: true,
    persistAcrossSessions: false,
    runAt: 'document_start',
    allFrames: true,
    id: 'isolated',
    js: ['content_scripts/isolated.js'],
    matches: ['<all_urls>'],
    world: 'ISOLATED'
  }
  await chrome.scripting.registerContentScripts([mainForegroundRule, isolatedRule])
  await initializeContentScripts()
  applyDisabledSettingsForTabs()
}
