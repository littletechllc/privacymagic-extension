import { updateAllowRules } from '@src/background/dnr/allow-rules'
import { updateContentRule } from '@src/background/dnr/content-rules'
import { updateNetworkRules } from '@src/background/dnr/network-rules'
import { SettingsId } from '@src/common/settings-ids'
import { getAllSettings } from '@src/common/settings'

export const updateRules = async (domain: string, settingId: SettingsId, value: boolean): Promise<void> => {
  const contentScriptUpdateRuleOptions = updateContentRule(domain, settingId, value)
  const networkUpdateRuleOptions = updateNetworkRules(domain, settingId, value)
  const allowUpdateRuleOptions = updateAllowRules(domain, settingId, value)
  const updateRuleOptions = {
    removeRuleIds: [
      ...(contentScriptUpdateRuleOptions.removeRuleIds ?? []),
      ...(networkUpdateRuleOptions.removeRuleIds ?? []),
      ...(allowUpdateRuleOptions.removeRuleIds ?? [])
    ],
    addRules: [
      ...(contentScriptUpdateRuleOptions.addRules ?? []),
      ...(networkUpdateRuleOptions.addRules ?? []),
      ...(allowUpdateRuleOptions.addRules ?? [])
    ]
  }
  await chrome.declarativeNetRequest.updateSessionRules(updateRuleOptions)
}

export const setupRules = async (): Promise<void> => {
  const allSettings = await getAllSettings()
  for (const [domain, settingId, value] of allSettings) {
    await updateRules(domain, settingId, value)
  }
}

export const clearRules = async (): Promise<void> => {
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules()
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: sessionRules.map(rule => rule.id)
  })
}