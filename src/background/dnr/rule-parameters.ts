export enum DNR_RULE_PRIORITIES {
  STATIC_RULES = 1,
  BLOCKER_EXCEPTIONS = 3,
  NETWORK = 4,
  MASTER_SWITCH = 6,
  CONTENT_SCRIPTS = 7
}

/**
 * Valid category IDs for DNR rules.
 */
export type CategoryId = 'content_rule' | 'network_rule' | 'allow_rule' | 'http_warnings'

const nameToIdMap = new Map<string, number>();

let highestId = 0;

/**
 * Generates a unique ID for a rule based on its category and name.
 *
 * @param category - The category of the rule (enforced at compile time).
 * @param ruleName - The name of the rule (arbitrary string).
 * @returns A unique numeric ID for the rule.
 */
export const dnrRuleIdForName = (category: CategoryId, ruleName: string): number => {
  const key = JSON.stringify([category, ruleName])
  if (!nameToIdMap.has(key)) {
    highestId++
    nameToIdMap.set(key, highestId)
  }
  return nameToIdMap.get(key)!
}