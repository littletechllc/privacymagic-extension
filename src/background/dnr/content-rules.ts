import { updateListOfExceptions } from '@src/common/util'
import { SettingsId } from '@src/common/settings-ids'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

const disabledSettingsForTopDomains: Map<string, SettingsId[]> = new Map()

const idForTopDomain = (domain: string): number => {
  return dnrRuleIdForName(`disabled_settings|${domain}`)
}

const createRuleForTopDomain = (domain: string, settings: SettingsId[]): chrome.declarativeNetRequest.Rule => {
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

export const updateContentRule = (domain: string, setting: SettingsId, value: boolean): chrome.declarativeNetRequest.UpdateRuleOptions => {
  const currentDisabledSettings: SettingsId[] | undefined = disabledSettingsForTopDomains.get(domain)
  const updatedDisabledSettings: SettingsId[] = updateListOfExceptions<SettingsId>(currentDisabledSettings, setting, value) ?? []
  disabledSettingsForTopDomains.set(domain, updatedDisabledSettings)
  if (updatedDisabledSettings.length === 0) {
    return { removeRuleIds: [idForTopDomain(domain)], addRules: [] }
  } else {
    const rule = createRuleForTopDomain(domain, updatedDisabledSettings)
    return { removeRuleIds: [rule.id], addRules: [rule] }
  }
}
