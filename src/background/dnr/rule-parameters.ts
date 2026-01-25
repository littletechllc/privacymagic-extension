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

const encoderForFnv1a = new TextEncoder();

/**
 * FNV-1a hash function.
 * @param str - The string to hash.
 * @returns The hash value.
 */
function fnv1a(str: string): number {
  const bytes = encoderForFnv1a.encode(str);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Generates a unique ID for a rule based on its category and name.
 *
 * @param category - The category of the rule (enforced at compile time).
 * @param ruleName - The name of the rule (arbitrary string).
 * @returns A unique numeric ID for the rule.
 */
export const dnrRuleIdForName = (category: CategoryId, ruleName: string): number => {
  const key = JSON.stringify([category, ruleName])
  // Keep range of IDs to fit into 32 bit integer comfortably.
  return (fnv1a(key) % 1_000_000_000) + 1
}