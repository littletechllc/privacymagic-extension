import { ALL_RESOURCE_TYPES, updateListOfExceptions } from "../common/util";
import { idForRuleName } from "./dnr-rule-ids";

const cachedMasterSwitchRule: chrome.declarativeNetRequest.Rule = {
    id: idForRuleName('masterSwitch'),
    priority: 6,
    action: { type: 'allow' },
    condition: {
      topDomains: undefined,
      resourceTypes: ALL_RESOURCE_TYPES
    }
}

export const updateMasterSwitchRule = async (domain: string, value: boolean): Promise<void> => {
  cachedMasterSwitchRule.condition.topDomains = updateListOfExceptions<string>(cachedMasterSwitchRule.condition.topDomains, domain, value)
  if (cachedMasterSwitchRule.condition.topDomains === undefined || cachedMasterSwitchRule.condition.topDomains.length === 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [cachedMasterSwitchRule.id], addRules: [] })
  } else {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [cachedMasterSwitchRule.id], addRules: [cachedMasterSwitchRule] })
  }
}
