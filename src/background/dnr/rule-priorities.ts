/**
 * Globally-defined priorities for DNR rules.
 * Higher values take precedence over lower ones when multiple rules apply.
 * These can be renumbered or spaced apart without changing rule identity; see `rule-ids.ts` for stable IDs.
 */
export enum DNR_RULE_PRIORITIES {
  STATIC_RULES = 1,
  BLOCKER_EXCEPTIONS = 3,
  NETWORK = 4,
  MASTER_SWITCH = 6,
  CONTENT_SCRIPTS = 7
}
