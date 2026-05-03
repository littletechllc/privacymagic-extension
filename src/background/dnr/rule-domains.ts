/**
 * Substitute hostname when the user has not disabled any top domain for a setting.
 *
 * Each built rule scopes with `topDomains` or `excludedTopDomains`. Chrome’s
 * declarativeNetRequest API rejects those properties when given an empty array,
 * so when the user list is empty we substitute one hostname. The value is not
 * a real registrable domain.
 */
export const RULE_DOMAIN_PLACEHOLDER = 'dummy-domain'

/** Non-empty domain list passed into rule builders (after {@link ensureNonEmptyDomains}). */
export type NonEmptyDomainList = readonly [string, ...string[]]

export function ensureNonEmptyDomains(domains: string[]): NonEmptyDomainList {
  if (domains.length === 0) {
    return [RULE_DOMAIN_PLACEHOLDER]
  }
  return [domains[0], ...domains.slice(1)]
}
