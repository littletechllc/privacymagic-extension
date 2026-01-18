// Type declarations for npm packages

declare module 'psl' {
  const psl: {
    get: (hostname: string) => string | null
  }
  export default psl
}

declare module 'punycode-npm' {
  const punycode: {
    toUnicode: (domain: string) => string
    toASCII: (domain: string) => string
  }
  export default punycode
}

// Temporary augmentation for Chrome types until @types/chrome is updated
// TODO: Remove when @types/chrome includes topDomains and excludedTopDomains
declare namespace chrome.declarativeNetRequest {
  interface RuleCondition {
    /**
     * The rule will only match network requests when the top-level domain matches one from the list of `topDomains`.
     * If the list is omitted, the rule is applied to requests from all top-level domains.
     * An empty list is not allowed.
     *
     * Notes:
     * Sub-domains like "a.example.com" are also allowed.
     * The entries must consist of only ascii characters.
     * Use punycode encoding for internationalized domains.
     * @since Chrome (recent version)
     */
    topDomains?: string[] | undefined;

    /**
     * The rule will not match network requests when the top-level domain matches one from the list of `excludedTopDomains`.
     * If the list is empty or omitted, no top-level domains are excluded.
     * This takes precedence over `topDomains`.
     *
     * Notes:
     * Sub-domains like "a.example.com" are also allowed.
     * The entries must consist of only ascii characters.
     * Use punycode encoding for internationalized domains.
     * @since Chrome (recent version)
     */
    excludedTopDomains?: string[] | undefined;
  }
}
