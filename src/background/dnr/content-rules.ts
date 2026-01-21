import { updateListOfExceptions } from '@src/common/util'
import { SettingId } from '@src/common/setting-ids'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

const category = 'content_rule'

const idForTopDomain = (domain: string): number => {
  return dnrRuleIdForName(category, domain)
}

const createRuleForTopDomain = (domain: string, settings: SettingId[]): chrome.declarativeNetRequest.Rule => {
  const id = idForTopDomain(domain)
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
      topDomains: [domain],
      resourceTypes: ["main_frame", "sub_frame"],
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

export const updateContentRule = async (domain: string, setting: SettingId, value: boolean): Promise<void> => {
  const ruleId = dnrRuleIdForName(category, domain)
  const oldRules = await chrome.declarativeNetRequest.getSessionRules({ruleIds: [ruleId]})
  const oldRule = oldRules[0]
  const currentDisabledSettings = disabledSettingsFromRule(oldRule)
  const updatedDisabledSettings: SettingId[] = updateListOfExceptions<SettingId>(currentDisabledSettings, setting, value) ?? []
  const rule = createRuleForTopDomain(domain, updatedDisabledSettings)
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: [rule.id],
    addRules: []
  }
  if (updatedDisabledSettings.length > 0) {
    updateRuleOptions.addRules = [rule]
  }
  await chrome.declarativeNetRequest.updateSessionRules(updateRuleOptions)
}
