import { updateListOfExceptions } from '@src/common/util'
import { SettingId } from '@src/common/setting-ids'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

const disabledSettingsForTopDomains: Map<string, SettingId[]> = new Map()

const idForTopDomain = (domain: string): number => {
  return dnrRuleIdForName(`disabled_settings|${domain}`)
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

export const updateContentRule = (domain: string, setting: SettingId, value: boolean): chrome.declarativeNetRequest.UpdateRuleOptions => {
  const currentDisabledSettings: SettingId[] | undefined = disabledSettingsForTopDomains.get(domain)
  const updatedDisabledSettings: SettingId[] = updateListOfExceptions<SettingId>(currentDisabledSettings, setting, value) ?? []
  disabledSettingsForTopDomains.set(domain, updatedDisabledSettings)
  if (updatedDisabledSettings.length === 0) {
    return { removeRuleIds: [idForTopDomain(domain)], addRules: [] }
  } else {
    const rule = createRuleForTopDomain(domain, updatedDisabledSettings)
    return { removeRuleIds: [rule.id], addRules: [rule] }
  }
}
