import '@test/mocks/globals'
import { describe, it, expect } from '@jest/globals'
import {
  ALLOW_RULE_SLOTS,
  allowRuleId,
  CONTENT_RULE_SLOTS,
  contentRuleId,
  NETWORK_RULE_SLOTS,
  networkRuleId,
  QUERY_PARAMETERS_RULE_SLOTS,
  queryParametersRuleId
} from '@src/background/dnr/rule-ids'
import type { NetworkRuleId } from '@src/background/dnr/rule-ids'
import { DNR_RULE_PRIORITIES } from '@src/background/dnr/rule-priorities'
import { BLOCKER_SETTING_IDS, CONTENT_SETTING_IDS } from '@src/common/setting-ids'
import { disallowedQueryParams } from '@src/background/dnr/network-rule-defs'

describe('DNR_RULE_PRIORITIES', () => {
  it('should have priorities in ascending order', () => {
    const priorities = [
      DNR_RULE_PRIORITIES.STATIC_RULES,
      DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS,
      DNR_RULE_PRIORITIES.NETWORK,
      DNR_RULE_PRIORITIES.MASTER_SWITCH,
      DNR_RULE_PRIORITIES.CONTENT_SCRIPTS
    ]
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThan(priorities[i - 1])
    }
  })

  it('should use fixed numeric values', () => {
    expect(DNR_RULE_PRIORITIES.STATIC_RULES).toBe(1)
    expect(DNR_RULE_PRIORITIES.CONTENT_SCRIPTS).toBe(7)
  })
})

describe('CONTENT_RULE_IDS', () => {
  it('should assign 1..25 exactly once per content setting', () => {
    expect(Object.keys(CONTENT_RULE_SLOTS)).toHaveLength(CONTENT_SETTING_IDS.length)
    for (const id of CONTENT_SETTING_IDS) {
      expect(CONTENT_RULE_SLOTS).toHaveProperty(id)
    }
    const sorted = [...Object.values(CONTENT_RULE_SLOTS)].sort((a, b) => a - b)
    expect(sorted).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
  })
})

describe('contentRuleId', () => {
  it('is stable for the same setting and enabled flag', () => {
    expect(contentRuleId('gpc', true)).toBe(contentRuleId('gpc', true))
  })

  it('differs by setting and by enabled flag', () => {
    expect(contentRuleId('gpc', true)).not.toBe(contentRuleId('gpc', false))
    expect(contentRuleId('gpc', true)).not.toBe(contentRuleId('cpu', true))
  })

  it('returns positive integers', () => {
    const id = contentRuleId('gpc', true)
    expect(id).toBeGreaterThan(0)
    expect(Number.isInteger(id)).toBe(true)
  })

  it('matches enabled/disabled offsets plus CONTENT_RULE_IDS', () => {
    for (const settingId of CONTENT_SETTING_IDS) {
      const slot = CONTENT_RULE_SLOTS[settingId]
      expect(contentRuleId(settingId, true)).toBe(1000 + slot)
      expect(contentRuleId(settingId, false)).toBe(2000 + slot)
    }
  })

  it('uses disjoint bands for enabled vs disabled for the same setting', () => {
    for (const settingId of CONTENT_SETTING_IDS) {
      expect(contentRuleId(settingId, true)).toBeLessThan(2000)
      expect(contentRuleId(settingId, false)).toBeGreaterThanOrEqual(2000)
      expect(contentRuleId(settingId, false)).toBeLessThan(3000)
    }
  })

  it('produces unique ids across all enabled rules', () => {
    const ids = CONTENT_SETTING_IDS.map(s => contentRuleId(s, true))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('produces unique ids across all disabled rules', () => {
    const ids = CONTENT_SETTING_IDS.map(s => contentRuleId(s, false))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('ALLOW_RULE_IDS and allowRuleId', () => {
  it('maps blockers to small sequential slots', () => {
    expect(ALLOW_RULE_SLOTS.ads).toBe(1)
    expect(ALLOW_RULE_SLOTS.masterSwitch).toBe(2)
  })

  it('matches allow band plus ALLOW_RULE_IDS', () => {
    for (const settingId of BLOCKER_SETTING_IDS) {
      expect(allowRuleId(settingId)).toBe(3000 + ALLOW_RULE_SLOTS[settingId])
    }
  })

  it('is stable and distinct per blocker setting', () => {
    expect(allowRuleId('ads')).toBe(allowRuleId('ads'))
    expect(allowRuleId('ads')).not.toBe(allowRuleId('masterSwitch'))
  })
})

describe('QUERY_PARAMETERS_RULE_IDS and queryParametersRuleId', () => {
  it('has one slot per disallowed query param', () => {
    expect(Object.keys(QUERY_PARAMETERS_RULE_SLOTS)).toHaveLength(disallowedQueryParams.length)
    for (const p of disallowedQueryParams) {
      expect(QUERY_PARAMETERS_RULE_SLOTS).toHaveProperty(p)
    }
  })

  it('matches query-parameters band plus map slot', () => {
    for (const p of disallowedQueryParams) {
      expect(queryParametersRuleId(p)).toBe(4000 + QUERY_PARAMETERS_RULE_SLOTS[p])
    }
  })

  it('is stable and assigns distinct ids per param', () => {
    const ids = disallowedQueryParams.map(p => queryParametersRuleId(p))
    expect(new Set(ids).size).toBe(ids.length)
    expect(queryParametersRuleId('gclid')).toBe(queryParametersRuleId('gclid'))
  })
})

describe('NETWORK_RULE_IDS and networkRuleId', () => {
  it('is stable and distinct per logical rule', () => {
    expect(networkRuleId('gpc')).toBe(networkRuleId('gpc'))
    expect(networkRuleId('gpc')).not.toBe(networkRuleId('network'))
    expect(networkRuleId('referrerPolicyStrictOriginWhenCrossOrigin')).not.toBe(
      networkRuleId('referrerPolicyStrictOrigin')
    )
  })

  it('matches network band plus NETWORK_RULE_IDS', () => {
    const keys = Object.keys(NETWORK_RULE_SLOTS) as NetworkRuleId[]
    for (const k of keys) {
      expect(networkRuleId(k)).toBe(5000 + NETWORK_RULE_SLOTS[k])
    }
  })

  it('assigns distinct ids for every network rule slot', () => {
    const keys = Object.keys(NETWORK_RULE_SLOTS) as NetworkRuleId[]
    const ids = keys.map(k => networkRuleId(k))
    expect(new Set(ids).size).toBe(keys.length)
  })
})

describe('rule id bands', () => {
  it('keeps representative ids from each family in separate numeric ranges', () => {
    const samples = [
      contentRuleId('audio', true),
      contentRuleId('audio', false),
      allowRuleId('ads'),
      queryParametersRuleId('fbclid'),
      networkRuleId('useragent')
    ]
    expect(new Set(samples).size).toBe(samples.length)
    expect(samples[0]).toBeGreaterThanOrEqual(1000)
    expect(samples[0]).toBeLessThan(2000)
    expect(samples[1]).toBeGreaterThanOrEqual(2000)
    expect(samples[1]).toBeLessThan(3000)
    expect(samples[2]).toBeGreaterThanOrEqual(3000)
    expect(samples[2]).toBeLessThan(4000)
    expect(samples[3]).toBeGreaterThanOrEqual(4000)
    expect(samples[3]).toBeLessThan(5000)
    expect(samples[4]).toBeGreaterThanOrEqual(5000)
    expect(samples[4]).toBeLessThan(6000)
  })
})
