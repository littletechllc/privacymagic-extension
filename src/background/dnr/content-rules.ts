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

export const updateContentScriptRule = async (domain: string, setting: SettingsId, value: boolean): Promise<void> => {
  const currentDisabledSettings: SettingsId[] | undefined = disabledSettingsForTopDomains.get(domain)
  const updatedDisabledSettings: SettingsId[] = updateListOfExceptions<SettingsId>(currentDisabledSettings, setting, value) ?? []
  disabledSettingsForTopDomains.set(domain, updatedDisabledSettings)
  if (updatedDisabledSettings.length === 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [idForTopDomain(domain)], addRules: [] })
  } else {
    const rule = createRuleForTopDomain(domain, updatedDisabledSettings)
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] })
    console.log('updated content script rule for domain', rule)
  }
}
