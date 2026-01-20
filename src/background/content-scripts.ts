import { updateListOfExceptions } from '../common/util'
import { getAllSettings } from '../common/settings'
import { SettingsId } from '../common/settings-ids'
import { idForSetting } from './ids'

const disabledSettingsForTopDomains: Map<string, SettingsId[]> = new Map()

const idForTopDomain = (domain: string): number => {
  return idForSetting(`disabled_settings|${domain}`)
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
    priority: 7,
    condition: {
      topDomains: [domain],
      resourceTypes: ["main_frame", "sub_frame"],
    }
  }
}

export const updateContentScriptRule = async (domain: string, setting: SettingsId, value: boolean): Promise<void> => {
  const currentDisabledSettings = disabledSettingsForTopDomains.get(domain)
  const updatedDisabledSettings = updateListOfExceptions(currentDisabledSettings, setting, value) ?? []
  disabledSettingsForTopDomains.set(domain, updatedDisabledSettings)
  if (updatedDisabledSettings.length === 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [idForTopDomain(domain)], addRules: [] })
  } else {
    const rule = createRuleForTopDomain(domain, updatedDisabledSettings)
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] })
    console.log('updated content script rule for domain', rule)
  }
}

export const setupContentScripts = async (): Promise<void> => {
  const settings = await getAllSettings()
  for (const [domain, settingId, value] of settings) {
    await updateContentScriptRule(domain, settingId, value)
  }
}