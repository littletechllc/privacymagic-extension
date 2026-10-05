export const FILTER_LIST_DIR = 'filter_list'
export const NETWORK_RULES_FILE = 'network_rules.json'
export const NETWORK_RULES_PATH = `${FILTER_LIST_DIR}/${NETWORK_RULES_FILE}`
export const HOSTNAME_RULES_FILE = 'hostname_rules.json'
export const HOSTNAME_RULES_PATH = `${FILTER_LIST_DIR}/${HOSTNAME_RULES_FILE}`
export const COSMETIC_FILTERS_DIR = `${FILTER_LIST_DIR}/cosmetic_filters`
export const SCRIPTLET_RULES_FILE = 'scriptlet_rules.json'
export const PROCEDURAL_FILTERS_FILE = 'procedural_filters.json'

/**
 * Compact hostname list (string[]) for Firefox webRequest blocking experiments:
 * bundle via esbuild import, or fetch from the packaged extension path after copy.
 */
export const BLOCKED_HOSTNAMES_JSON_PATH = 'src/background/generated/blocked-hostnames.json'
