/**
 * DNR rule numeric IDs: per-setting slots, category offsets, and helpers that produce the
 * final `chrome.declarativeNetRequest.Rule.id` values used when registering dynamic rules.
 *
 * **Warning:** These IDs are hardcoded and should not be changed or removed.
 * Instead, add new slots or offsets when needed.
 */

import { BlockerSettingId, ContentSettingId, NetworkSettingId } from '@src/common/setting-ids'
import type { DisallowedQueryParam } from '@src/background/dnr/network-rule-defs'

export const CONTENT_RULE_SLOTS: Record<ContentSettingId, number> = {
  audio: 1,
  battery: 2,
  cpu: 3,
  device: 4,
  disk: 5,
  display: 6,
  fonts: 7,
  gpc: 8,
  gpu: 9,
  iframe: 10,
  keyboard: 11,
  language: 12,
  masterSwitch: 13,
  math: 14,
  memory: 15,
  network: 16,
  screen: 17,
  serviceWorker: 18,
  sharedStorage: 19,
  timezone: 20,
  timer: 21,
  touch: 22,
  useragent: 23,
  windowName: 24,
  worker: 25
}

export type NetworkRuleId = Exclude<NetworkSettingId, 'queryParameters' | 'referrerPolicy'> | 'referrerPolicyStrictOriginWhenCrossOrigin' | 'referrerPolicyStrictOrigin'

export const NETWORK_RULE_SLOTS: Record<NetworkRuleId, number> = {
  gpc: 1,
  network: 2,
  useragent: 3,
  screen: 4,
  display: 5,
  language: 6,
  memory: 7,
  cpu: 8,
  device: 9,
  referrerPolicyStrictOriginWhenCrossOrigin: 10,
  referrerPolicyStrictOrigin: 11
}

export const ALLOW_RULE_SLOTS: Record<BlockerSettingId, number> = {
  ads: 1,
  masterSwitch: 2
}

export const QUERY_PARAMETERS_RULE_SLOTS: Record<DisallowedQueryParam, number> = {
  __hsfp: 1,
  __hssc: 2,
  __hstc: 3,
  __s: 4,
  _hsenc: 5,
  _openstat: 6,
  dclid: 7,
  fbclid: 8,
  gclid: 9,
  hsCtaTracking: 10,
  mc_eid: 11,
  mkt_tok: 12,
  ml_subscriber: 13,
  ml_subscriber_hash: 14,
  msclkid: 15,
  oly_anon_id: 16,
  oly_enc_id: 17,
  rb_clickid: 18,
  s_cid: 19,
  vero_conv: 20,
  vero_id: 21,
  wickedid: 22,
  yclid: 23
}

/**
 * Valid category IDs for DNR rules.
 */
export type CategoryId = 'content_rule_enabled' | 'content_rule_disabled' | 'network_rule' | 'allow_rule' | 'query_parameters_rule'

const CATEGORY_OFFSETS: Record<CategoryId, number> = {
  content_rule_enabled: 1000,
  content_rule_disabled: 2000,
  allow_rule: 3000,
  query_parameters_rule: 4000,
  network_rule: 5000
} as const

export const MINIMUM_SETTINGS_RULE_ID = Math.min(...Object.values(CATEGORY_OFFSETS))

export const contentRuleId = (settingId: ContentSettingId, enabled: boolean): number => {
  const offset = enabled ? CATEGORY_OFFSETS['content_rule_enabled'] : CATEGORY_OFFSETS['content_rule_disabled']
  return offset + CONTENT_RULE_SLOTS[settingId]
}

export const allowRuleId = (settingId: BlockerSettingId): number => {
  return CATEGORY_OFFSETS['allow_rule'] + ALLOW_RULE_SLOTS[settingId]
}

export const queryParametersRuleId = (queryParam: DisallowedQueryParam): number => {
  return CATEGORY_OFFSETS['query_parameters_rule'] + QUERY_PARAMETERS_RULE_SLOTS[queryParam]
}

export const networkRuleId = (settingId: NetworkRuleId): number => {
  const offset = CATEGORY_OFFSETS['network_rule']
  return offset + NETWORK_RULE_SLOTS[settingId]
}
