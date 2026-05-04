// Allow rules are used to allow network requests for specific top domains.
// Any of the allow rules is applied only to web pages under top domains
// for which the corresponding setting is disabled.

import { ALL_RESOURCE_TYPES } from "@src/common/util";
import { allowRuleId } from '@src/background/dnr/rule-ids'
import { DNR_RULE_PRIORITIES } from '@src/background/dnr/rule-priorities'
import { BlockerSettingId, isBlockerSetting, SettingId } from "@src/common/setting-ids";
import type { NonEmptyDomainList } from '@src/background/dnr/rule-domains'

const BASE_RULES: Record<BlockerSettingId, (topDomains: NonEmptyDomainList) => chrome.declarativeNetRequest.Rule> = {
  masterSwitch: (topDomains: NonEmptyDomainList) => ({
    id: allowRuleId('masterSwitch'),
    priority: DNR_RULE_PRIORITIES.MASTER_SWITCH,
    action: { type: 'allow' },
    condition: { topDomains: [...topDomains], resourceTypes: ALL_RESOURCE_TYPES }
  }),
  ads: (topDomains: NonEmptyDomainList) => ({
    id: allowRuleId('ads'),
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
