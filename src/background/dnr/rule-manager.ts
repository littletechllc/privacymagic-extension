import { updateAllowRules } from '@src/background/dnr/allow-rules'
import { setupDefaultContentRule, updateContentRule } from '@src/background/dnr/content-rules'
import { setupDefaultNetworkRules, updateNetworkRules } from '@src/background/dnr/network-rules'
import { SettingId } from '@src/common/setting-ids'
import { getAllSettings } from '@src/common/settings'

export const updateRules = async (domain: string, settingId: SettingId, value: boolean): Promise<void> => {
  await updateContentRule(domain, settingId, value)
  await updateNetworkRules(domain, settingId, value)
  await updateAllowRules(domain, settingId, value)
}

export const setupRules = async (): Promise<void> => {
  await setupDefaultContentRule()
  await setupDefaultNetworkRules()
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