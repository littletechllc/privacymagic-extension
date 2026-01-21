import { ALL_RESOURCE_TYPES, updateListOfExceptions } from "@src/common/util";
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from "@src/background/dnr/rule-parameters";
import { SettingId } from "@src/common/setting-ids";

const category = 'allow_rule'

const BASE_RULES: Partial<Record<SettingId, chrome.declarativeNetRequest.Rule>> = {
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

export const updateAllowRules = async (domain: string, setting: SettingId, value: boolean): Promise<void> => {
  if (!(setting in BASE_RULES)) {
    return
  }
  const ruleId = dnrRuleIdForName(category, setting)
  const oldRules = await chrome.declarativeNetRequest.getSessionRules({ruleIds: [ruleId]})
  const rule = oldRules.length ? oldRules[0] : BASE_RULES[setting]
  if (rule === undefined) {
    return
  }
  rule.condition.topDomains = updateListOfExceptions<string>(rule.condition.topDomains, domain, value)
  const ruleIsInUse = rule.condition.topDomains !== undefined && rule.condition.topDomains.length > 0
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: [rule.id],
    addRules: ruleIsInUse ? [rule] : []
  }
  await chrome.declarativeNetRequest.updateSessionRules(updateRuleOptions)
}
