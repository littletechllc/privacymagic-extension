import { computeAllowRuleUpdates } from '@src/background/dnr/allow-rules'
import { computeContentRuleUpdates, computeDefaultContentRuleUpdate } from '@src/background/dnr/content-rules'
import { computeNetworkRuleUpdates, computeDefaultNetworkRuleUpdates } from '@src/background/dnr/network-rules'
import { SettingId } from '@src/common/setting-ids'
import { getAllSettings } from '@src/common/settings'

const dedupeRulesByIdKeepLast = (rules: chrome.declarativeNetRequest.Rule[]): chrome.declarativeNetRequest.Rule[] => {
  const ruleById = new Map<number, chrome.declarativeNetRequest.Rule>()
  for (const rule of rules) {
    // Keep last rule with the same id, and keep rules in order.
    ruleById.delete(rule.id)
    ruleById.set(rule.id, rule)
  }
  return [...ruleById.values()]
}

const updateDynamicRules = async (updateRuleOptionsList: (chrome.declarativeNetRequest.UpdateRuleOptions | undefined)[]): Promise<void> => {
  const updateRuleOptions = updateRuleOptionsList.filter(options => options !== undefined)
  const removeRuleIdsRaw = updateRuleOptions.flatMap(options => options.removeRuleIds ?? [])
  const addRulesRaw = updateRuleOptions.flatMap(options => options.addRules ?? [])
  const removeRuleIds = [...new Set(removeRuleIdsRaw)]
  const addRules = dedupeRulesByIdKeepLast(addRulesRaw)
  if (removeRuleIds.length > 0 || addRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    })
  }
}

const computeRuleUpdates = async (domain: string, settingId: SettingId, value: boolean): Promise<(chrome.declarativeNetRequest.UpdateRuleOptions | undefined)[]> => {
  const contentRuleUpdates = await computeContentRuleUpdates(domain, settingId, value)
  const networkRuleUpdates = await computeNetworkRuleUpdates(domain, settingId, value)
  const allowRuleUpdates = await computeAllowRuleUpdates(domain, settingId, value)
  return [contentRuleUpdates, networkRuleUpdates, allowRuleUpdates]
}

export const updateRules = async (domain: string, settingId: SettingId, value: boolean): Promise<void> => {
  const ruleUpdates = await computeRuleUpdates(domain, settingId, value)
  await updateDynamicRules(ruleUpdates)
}

export const setupRules = async (): Promise<void> => {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules()
  const clearOldRulesUpdate = oldRules.map(rule => ({
    removeRuleIds: [rule.id]
  }))
  const defaultContentRuleUpdate = computeDefaultContentRuleUpdate()
  const defaultNetworkRuleUpdates = computeDefaultNetworkRuleUpdates()
  const updateRuleOptionsList = [...clearOldRulesUpdate, defaultContentRuleUpdate, ...defaultNetworkRuleUpdates]
  const allSettings = await getAllSettings()
  for (const [domain, settingId, value] of allSettings) {
    const ruleUpdates = await computeRuleUpdates(domain, settingId, value)
    updateRuleOptionsList.push(...ruleUpdates)
  }
  await updateDynamicRules(updateRuleOptionsList)
}
