// Allow rules are used to allow network requests for specific top domains.
// Any of the allow rules is applied only to web pages under top domains
// for which the corresponding setting is disabled.

import { ALL_RESOURCE_TYPES } from "@src/common/util";
import { includeInListIfNeeded } from "@src/common/data-structures";
import { CategoryId, DNR_RULE_PRIORITIES, dnrRuleIdForName } from "@src/background/dnr/rule-parameters";
import { BlockerSettingId, SettingId } from "@src/common/setting-ids";

const category: CategoryId = 'allow_rule'

const BASE_RULES: Record<BlockerSettingId, chrome.declarativeNetRequest.Rule> = {
  masterSwitch: {
    id: dnrRuleIdForName(category, 'masterSwitch'),
    priority: DNR_RULE_PRIORITIES.MASTER_SWITCH,
    action: { type: 'allow' },
    condition: { topDomains: undefined, resourceTypes: ALL_RESOURCE_TYPES }
  },
  ads: {
    id: dnrRuleIdForName(category, 'ads'),
    priority: DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS,
    action: { type: 'allow' },
    condition: { topDomains: undefined, resourceTypes: ALL_RESOURCE_TYPES }
  }
}

const isBlockerSetting = (setting: SettingId): setting is BlockerSettingId => {
  return setting in BASE_RULES
}

export const updateAllowRules = async (domain: string, setting: SettingId, protectionEnabled: boolean): Promise<void> => {
  if (!isBlockerSetting(setting)) {
    return
  }
  const ruleId = dnrRuleIdForName(category, setting)
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules({ruleIds: [ruleId]})
  const rule = oldRules.length ? oldRules[0] : BASE_RULES[setting]
  rule.condition.topDomains = includeInListIfNeeded<string>(rule.condition.topDomains, domain, !protectionEnabled)
  const ruleIsInUse = rule.condition.topDomains !== undefined && rule.condition.topDomains.length > 0
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: [rule.id],
    addRules: ruleIsInUse ? [rule] : []
  }
  await chrome.declarativeNetRequest.updateDynamicRules(updateRuleOptions)
}
