import { updateAllowRules } from '@src/background/dnr/allow-rules'
import { updateContentScriptRule } from '@src/background/dnr/content-rules'
import { updateNetworkRule } from '@src/background/dnr/network-rules'
import { SettingsId } from '@src/common/settings-ids'
import { getAllSettings } from '@src/common/settings'

export const updateRule = async (domain: string, settingId: SettingsId, value: boolean): Promise<void> => {
  await updateContentScriptRule(domain, settingId, value)
  await updateNetworkRule(domain, settingId, value)
  await updateAllowRules(domain, settingId, value)
}

export const setupRules = async (): Promise<void> => {
  const allSettings = await getAllSettings()
  for (const [domain, settingId, value] of allSettings) {
    await updateRule(domain, settingId, value)
  }
}

export const clearRules = async (): Promise<void> => {
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules()
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: sessionRules.map(rule => rule.id)
  })
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules()
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: dynamicRules.map(rule => rule.id)
  })
  console.log('cleared rules')
}