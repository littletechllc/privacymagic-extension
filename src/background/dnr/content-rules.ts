// Content rules are used to disable settings for specific top domains.
// Disabled settings are stored in a cookie set in the response headers
// of the web page and any subframes. One rule is created for each top domain
// whenever a setting is disabled for the top domain.
// The rule is removed if no settings are disabled for the top domain.

import { updateListOfExceptions } from '@src/common/util'
import { SettingId } from '@src/common/setting-ids'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

const category = 'content_rule'

const idForTopDomain = (domain: string): number => {
  return dnrRuleIdForName(category, domain)
}

const createRuleForTopDomain = (settings: SettingId[], domain?: string): chrome.declarativeNetRequest.Rule => {
  const id = domain == null ? dnrRuleIdForName(category, 'default') : idForTopDomain(domain)
  const cookieKeyVal = `__pm__disabled_settings=${settings.join(',')}`
  const headerValue = `${cookieKeyVal}; Secure; SameSite=None; Path=/; Partitioned`
  return {
    id,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'append',
        header: 'Set-Cookie',
        value: headerValue
      }]
    },
    priority: DNR_RULE_PRIORITIES.CONTENT_SCRIPTS,
    condition: {
      resourceTypes: ["main_frame", "sub_frame"],
      ...(domain == null ? { excludedTopDomains: [] } : { topDomains: [domain] })
    }
  }
}

const disabledSettingsFromRule = (rule: chrome.declarativeNetRequest.Rule | undefined): SettingId[] => {
  const cookieVal = rule?.action?.type === 'modifyHeaders'
    ? rule.action.responseHeaders?.find(header => header.header === 'Set-Cookie')?.value
    : undefined
  const match = cookieVal?.match(/^__pm__disabled_settings=([^;]+)/)
  return match?.[1]?.split(',').map(setting => setting.trim() as SettingId) ?? []
}

const getSingleRule = async (ruleId: number): Promise<chrome.declarativeNetRequest.Rule | undefined> => {
  const ruleResults = await chrome.declarativeNetRequest.getSessionRules({ruleIds: [ruleId]})
  return ruleResults.length > 0 ? ruleResults[0] : undefined
}

export const updateContentRule = async (domain: string, setting: SettingId, value: boolean): Promise<void> => {
  const ruleId = dnrRuleIdForName(category, domain)
  const defaultRuleId = dnrRuleIdForName(category, 'default')
  const [oldRule, oldDefaultRule] = await Promise.all([
    getSingleRule(ruleId),
    getSingleRule(defaultRuleId)
  ])
  const currentDisabledSettings = disabledSettingsFromRule(oldRule)
  const updatedDisabledSettings: SettingId[] = updateListOfExceptions<SettingId>(currentDisabledSettings, setting, value) ?? []
  const rule = createRuleForTopDomain(updatedDisabledSettings, domain)
  const defaultRule = oldDefaultRule ?? createRuleForTopDomain([])
  const domainHasDisabledSettings = updatedDisabledSettings.length > 0
  defaultRule.condition.excludedTopDomains = updateListOfExceptions<string>(defaultRule.condition.excludedTopDomains, domain, !domainHasDisabledSettings)
  const addRules = [defaultRule];
  if (domainHasDisabledSettings) {
    addRules.push(rule)
  }
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: [ruleId, defaultRuleId],
    addRules
  }
  await chrome.declarativeNetRequest.updateSessionRules(updateRuleOptions)
}

export const setupDefaultContentRule = async (): Promise<void> => {
  const defaultRule = createRuleForTopDomain([])
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [defaultRule]
  })
}