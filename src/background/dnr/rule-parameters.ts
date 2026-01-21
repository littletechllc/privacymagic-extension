export enum DNR_RULE_PRIORITIES {
  STATIC_RULES = 1,
  BLOCKER_EXCEPTIONS = 3,
  NETWORK = 4,
  MASTER_SWITCH = 6,
  CONTENT_SCRIPTS = 7
}

const nameToIdMap = new Map<string, number>();

let highestId = 0;

export const dnrRuleIdForName = (ruleName: string): number => {
  if (!nameToIdMap.has(ruleName)) {
    ++highestId
    nameToIdMap.set(ruleName, highestId)
  }
  return nameToIdMap.get(ruleName)!
}