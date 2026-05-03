// Allow rules are used to allow network requests for specific top domains.
// Any of the allow rules is applied only to web pages under top domains
// for which the corresponding setting is disabled.

import { ALL_RESOURCE_TYPES } from "@src/common/util";
import { CategoryId, DNR_RULE_PRIORITIES, dnrRuleIdForName } from "@src/background/dnr/rule-parameters";
import { BlockerSettingId, isBlockerSetting, SettingId } from "@src/common/setting-ids";
import type { NonEmptyDomainList } from '@src/background/dnr/rule-domains'

const ALLOW_RULE_CATEGORY: CategoryId = 'allow_rule'

const BASE_RULES: Record<BlockerSettingId, (topDomains: NonEmptyDomainList) => chrome.declarativeNetRequest.Rule> = {
  masterSwitch: (topDomains: NonEmptyDomainList) => ({
    id: dnrRuleIdForName(ALLOW_RULE_CATEGORY, 'masterSwitch'),
    priority: DNR_RULE_PRIORITIES.MASTER_SWITCH,
    action: { type: 'allow' },
    condition: { topDomains: [...topDomains], resourceTypes: ALL_RESOURCE_TYPES }
  }),
  ads: (topDomains: NonEmptyDomainList) => ({
    id: dnrRuleIdForName(ALLOW_RULE_CATEGORY, 'ads'),
    priority: DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS,
    action: { type: 'allow' },
    condition: { topDomains: [...topDomains], resourceTypes: ALL_RESOURCE_TYPES }
  }),
}

export const computeAllowRules = (setting: SettingId, domainsWhereSettingIsDisabled: NonEmptyDomainList): chrome.declarativeNetRequest.Rule[] => {
  if (!isBlockerSetting(setting)) {
    return []
  }
  return [BASE_RULES[setting](domainsWhereSettingIsDisabled)]
}
