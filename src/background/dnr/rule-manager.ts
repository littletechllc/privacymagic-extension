import { computeAllowRules } from '@src/background/dnr/allow-rules'
import { computeContentRules } from '@src/background/dnr/content-rules'
import { computeNetworkRules } from '@src/background/dnr/network-rules'
import { ensureNonEmptyDomains } from '@src/background/dnr/rule-domains'
import { ALL_SETTING_IDS, SettingId } from '@src/common/setting-ids'
import type { DisabledSettingCollection } from '@src/common/settings-read'

export { RULE_DOMAIN_PLACEHOLDER } from '@src/background/dnr/rule-domains'

const computeRules = (setting: SettingId, domainsWhereSettingIsDisabled: string[]): chrome.declarativeNetRequest.Rule[] => {
  const domains = ensureNonEmptyDomains(domainsWhereSettingIsDisabled)
  const contentRuleUpdates = computeContentRules(setting, domains)
  const networkRuleUpdates = computeNetworkRules(setting, domains)
  const allowRuleUpdates = computeAllowRules(setting, domains)
  return [...contentRuleUpdates, ...networkRuleUpdates, ...allowRuleUpdates]
}

const updateRules = async (rules: chrome.declarativeNetRequest.Rule[]): Promise<void> => {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules
  })
}

export const updateRulesForSetting = async (setting: SettingId, domainsWhereSettingIsDisabled: string[]): Promise<void> => {
  await updateRules(computeRules(setting, domainsWhereSettingIsDisabled))
}

export const updateRulesForAllSettings = async (domainsWhereSettingsAreDisabled: DisabledSettingCollection): Promise<void> => {
  const rules: chrome.declarativeNetRequest.Rule[] = []
  for (const settingId of ALL_SETTING_IDS) {
    rules.push(...computeRules(settingId, domainsWhereSettingsAreDisabled[settingId] ?? []))
  }
  await updateRules(rules)
}