// Content rules are used to disable settings for specific top domains.
// Disabled settings are stored in a cookie set in the response headers
// of the web page and any subframes. One rule is created for each top domain
// whenever a setting is disabled for the top domain.
// The rule is removed if no settings are disabled for the top domain.

import { includeInListIfNeeded } from '@src/common/data-structures'
import { CONTENT_SETTING_IDS, ContentSettingId, SettingId } from '@src/common/setting-ids'
import { CategoryId, DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

const category: CategoryId = 'content_rule'

const idForTopDomain = (domain: string): number => {
  return dnrRuleIdForName(category, domain)
}

const createRuleForTopDomain = (settings: ContentSettingId[], domain?: string): chrome.declarativeNetRequest.Rule => {
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

const disabledSettingsFromRule = (rule: chrome.declarativeNetRequest.Rule | undefined): ContentSettingId[] => {
  const cookieVal = rule?.action?.type === 'modifyHeaders'
    ? rule.action.responseHeaders?.find(header => header.header === 'Set-Cookie')?.value
    : undefined
  const match = cookieVal?.match(/^__pm__disabled_settings=([^;]+)/)
  return match?.[1]?.split(',').map(setting => setting.trim() as ContentSettingId) ?? []
}

const getSingleRule = async (ruleId: number): Promise<chrome.declarativeNetRequest.Rule | undefined> => {
  const ruleResults = await chrome.declarativeNetRequest.getDynamicRules({ruleIds: [ruleId]})
  return ruleResults.length > 0 ? ruleResults[0] : undefined
}

const isContentSetting = (setting: SettingId): setting is ContentSettingId => {
  return (CONTENT_SETTING_IDS as readonly string[]).includes(setting)
}

export const computeContentRuleUpdates = async (domain: string, setting: SettingId, protectionEnabled: boolean): Promise<chrome.declarativeNetRequest.UpdateRuleOptions | undefined> => {
  if (!isContentSetting(setting)) {
    return
  }
  const ruleId = dnrRuleIdForName(category, domain)
  const defaultRuleId = dnrRuleIdForName(category, 'default')
  const [oldRule, oldDefaultRule] = await Promise.all([
    getSingleRule(ruleId),
    getSingleRule(defaultRuleId)
  ])
  const currentDisabledSettings = disabledSettingsFromRule(oldRule)
  const updatedDisabledSettings: ContentSettingId[] = includeInListIfNeeded<ContentSettingId>(currentDisabledSettings, setting, !protectionEnabled) ?? []
  const rule = createRuleForTopDomain(updatedDisabledSettings, domain)
  const defaultRule = oldDefaultRule ?? createRuleForTopDomain([])
  const domainHasDisabledSettings = updatedDisabledSettings.length > 0
  defaultRule.condition.excludedTopDomains = includeInListIfNeeded<string>(defaultRule.condition.excludedTopDomains, domain, domainHasDisabledSettings)
  const addRules = [defaultRule];
  if (domainHasDisabledSettings) {
    addRules.push(rule)
  }
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: [ruleId, defaultRuleId],
    addRules
  }
  return updateRuleOptions
}

export const computeDefaultContentRuleUpdate = (): chrome.declarativeNetRequest.UpdateRuleOptions => {
  const defaultRule = createRuleForTopDomain([])
  return {
    removeRuleIds: [defaultRule.id],
    addRules: [defaultRule]
  }
}