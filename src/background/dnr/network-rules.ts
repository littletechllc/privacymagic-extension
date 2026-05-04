// Network rules are used to apply fingerprinting protections
// to network requests. They are applied to all network requests,
// except web pages under excluded top domains.

import { isNetworkSetting, SettingId } from '@src/common/setting-ids'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import { DNR_RULE_PRIORITIES } from '@src/background/dnr/rule-priorities'
import { NETWORK_PROTECTION_DEFS, type NetworkPartialRule } from '@src/background/dnr/network-rule-defs'
import type { NonEmptyDomainList } from '@src/background/dnr/rule-domains'

export const computeNetworkRules = (settingId: SettingId, excludedTopDomains: NonEmptyDomainList): chrome.declarativeNetRequest.Rule[] => {
  if (!isNetworkSetting(settingId)) {
    return []
  }
  const rules = NETWORK_PROTECTION_DEFS[settingId]
  return rules.map((rule: NetworkPartialRule) => ({
    ...rule,
    priority: DNR_RULE_PRIORITIES.NETWORK,
    condition: {
      resourceTypes: ALL_RESOURCE_TYPES,
      ...rule.condition,
      excludedTopDomains: [...excludedTopDomains]
    }
  }))
}
