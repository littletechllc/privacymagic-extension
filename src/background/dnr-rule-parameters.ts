const settingToIdMap = new Map<string, number>();

let highestId = 0;

export enum DNR_RULE_PRIORITIES {
  STATIC_RULES = 1,
  BLOCKER_EXCEPTIONS = 3,
  NETWORK = 4,
  MASTER_SWITCH = 6,
  CONTENT_SCRIPTS = 7
}

export const dnrRuleIdForName = (ruleName: string): number => {
  if (!settingToIdMap.has(ruleName)) {
    ++highestId
    settingToIdMap.set(ruleName, highestId)
  }
  return settingToIdMap.get(ruleName)!
}