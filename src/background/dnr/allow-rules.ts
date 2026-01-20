import { ALL_RESOURCE_TYPES, updateListOfExceptions } from "@src/common/util";
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from "@src/background/dnr/rule-parameters";
import { SettingsId } from "@src/common/settings-ids";

const cachedAllowRules: Partial<Record<SettingsId, chrome.declarativeNetRequest.Rule>> = {
  masterSwitch: {
    id: dnrRuleIdForName('allow_rule|masterSwitch'),
    priority: DNR_RULE_PRIORITIES.MASTER_SWITCH,
    action: { type: 'allow' },
    condition: { topDomains: undefined, resourceTypes: ALL_RESOURCE_TYPES }
  },
  ads: {
    id: dnrRuleIdForName('allow_rule|ads'),
    priority: DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS,
    action: { type: 'allow' },
    condition: { topDomains: undefined, resourceTypes: ALL_RESOURCE_TYPES }
  }
}

export const updateAllowRules = async (domain: string,setting: SettingsId, value: boolean): Promise<void> => {
  const rule = cachedAllowRules[setting]
  if (rule === undefined) {
    return
  }
  rule.condition.topDomains = updateListOfExceptions<string>(rule.condition.topDomains, domain, value)
  if (rule.condition.topDomains === undefined || rule.condition.topDomains.length === 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [] })
  } else {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] })
  }
}
