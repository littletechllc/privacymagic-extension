// Network rules are used to apply fingerprinting protections
// to network requests. They are applied to all network requests,
// except web pages under excluded top domains.

import { isNetworkSetting, SettingId } from '@src/common/setting-ids'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import { CategoryId, DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import { NETWORK_PROTECTION_DEFS } from '@src/background/dnr/network-rule-defs'
import type { NonEmptyDomainList } from '@src/background/dnr/rule-domains'

const NETWORK_RULE_CATEGORY: CategoryId = 'network_rule'

export const computeNetworkRules = (settingId: SettingId, excludedTopDomains: NonEmptyDomainList): chrome.declarativeNetRequest.Rule[] => {
  if (!isNetworkSetting(settingId)) {
    return []
  }
  const rules = NETWORK_PROTECTION_DEFS[settingId]
  return rules.map((rule, index) => ({
    id: dnrRuleIdForName(NETWORK_RULE_CATEGORY, settingId, index),
    priority: DNR_RULE_PRIORITIES.NETWORK,
    action: rule.action,
    condition: {
      resourceTypes: ALL_RESOURCE_TYPES,
      ...rule.condition,
      excludedTopDomains: [...excludedTopDomains]
    }
  }))
}
