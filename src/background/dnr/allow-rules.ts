import { ALL_RESOURCE_TYPES, updateListOfExceptions } from "@src/common/util";
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from "@src/background/dnr/rule-parameters";
import { SettingId } from "@src/common/setting-ids";

const category = 'allow_rule'

const cachedAllowRules: Partial<Record<SettingId, chrome.declarativeNetRequest.Rule>> = {
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

export const updateAllowRules = (domain: string, setting: SettingId, value: boolean): chrome.declarativeNetRequest.UpdateRuleOptions => {
  const rule = cachedAllowRules[setting]
  if (rule === undefined) {
    return { removeRuleIds: [], addRules: [] }
  }
  rule.condition.topDomains = updateListOfExceptions<string>(rule.condition.topDomains, domain, value)
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: [],
    addRules: []
  }
  updateRuleOptions.removeRuleIds!.push(rule.id)
  if (rule.condition.topDomains !== undefined && rule.condition.topDomains.length > 0) {
    updateRuleOptions.addRules!.push(rule)
  }
  return updateRuleOptions
}
