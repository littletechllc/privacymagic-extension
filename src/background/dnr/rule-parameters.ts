/**
 * Globally-defined priorities for DNR rules.
 */
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

/**
 * Map of category and rule name to unique ID.
 * The key is a JSON string of the category and rule name.
 * The value is a unique numeric ID.
 */
const nameToIdMap = new Map<string, number>();

/**
 * The highest ID currently assigned.
 */
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