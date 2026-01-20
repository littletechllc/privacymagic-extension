import { getAllSettings } from "@src/common/settings";
import { ALL_RESOURCE_TYPES, updateListOfExceptions } from "../common/util";
import { idForSetting } from "./ids";

const masterSwitchRule: chrome.declarativeNetRequest.Rule = {
    id: idForSetting('masterSwitch'),
    priority: 6,
    action: { type: 'allow' },
    condition: {
      topDomains: undefined,
      resourceTypes: ALL_RESOURCE_TYPES
    }
}

export const updateMasterSwitchRule = async (domain: string, value: boolean): Promise<void> => {
  masterSwitchRule.condition.topDomains = updateListOfExceptions(masterSwitchRule.condition.topDomains, domain, value)
  if (masterSwitchRule.condition.topDomains === undefined || masterSwitchRule.condition.topDomains.length === 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [masterSwitchRule.id], addRules: [] })
  } else {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [masterSwitchRule.id], addRules: [masterSwitchRule] })
  }
}

export const setupMasterSwitchRule = async (): Promise<void> => {
  const allSettings = await getAllSettings()
  for (const [domain, settingId, value] of allSettings) {
    if (settingId === 'masterSwitch' && value === false) {
      await updateMasterSwitchRule(domain, value)
    }
  }
}