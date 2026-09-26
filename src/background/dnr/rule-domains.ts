import { browserInfo } from '@src/common/browser'

/**
 * Substitute hostname when the user has not disabled any top domain for a setting.
 *
 * Chrome’s declarativeNetRequest API rejects an empty domain list, so when the
 * user list is empty we substitute one hostname. The value is not a real
 * registrable domain.
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

/** Safari compiles `domains` / `excludedDomains` to the top document. Chrome treats those keys as the initiator. */
export const topDomainCondition = (domains: NonEmptyDomainList, excluded: boolean): chrome.declarativeNetRequest.RuleCondition => {
  const list = [...domains]
  if (browserInfo.brand === 'Safari') {
    return excluded ? { excludedDomains: list } : { domains: list }
  }
  return excluded ? { excludedTopDomains: list } : { topDomains: list }
}
