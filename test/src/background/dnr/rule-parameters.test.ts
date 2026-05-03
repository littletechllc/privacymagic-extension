import '@test/mocks/globals'
import { describe, it, expect, beforeEach } from '@jest/globals'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import type { SettingId } from '@src/common/setting-ids'

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
})

describe('dnrRuleIdForName', () => {
  beforeEach(() => {
    // Reset the internal state by importing fresh (Jest modules are cached)
    // Actually, we can't easily reset the module state, so we'll test that
    // it returns consistent IDs for the same inputs
  })

  it('should return the same ID for the same category and ruleName', () => {
    const id1 = dnrRuleIdForName('content_rule', 'gpc')
    const id2 = dnrRuleIdForName('content_rule', 'gpc')
    expect(id1).toBe(id2)
  })

  it('should return different IDs for different categories', () => {
    const id1 = dnrRuleIdForName('content_rule', 'gpc')
    const id2 = dnrRuleIdForName('network_rule', 'gpc')
    expect(id1).not.toBe(id2)
  })

  it('should return different IDs for different rule names in the same category', () => {
    const id1 = dnrRuleIdForName('content_rule', 'gpc')
    const id2 = dnrRuleIdForName('content_rule', 'cpu')
    expect(id1).not.toBe(id2)
  })

  it('should return deterministic IDs for different category/name combinations', () => {
    const id1 = dnrRuleIdForName('content_rule', 'gpc')
    const id2 = dnrRuleIdForName('content_rule', 'cpu')
    const id3 = dnrRuleIdForName('content_rule', 'math')

    expect(id1).not.toBe(id2)
    expect(id2).not.toBe(id3)
    expect(id1).not.toBe(id3)

    expect(dnrRuleIdForName('content_rule', 'gpc')).toBe(id1)
    expect(dnrRuleIdForName('content_rule', 'cpu')).toBe(id2)
    expect(dnrRuleIdForName('content_rule', 'math')).toBe(id3)
  })

  it('should handle empty ruleName', () => {
    const empty = '' as SettingId
    const id1 = dnrRuleIdForName('content_rule', empty)
    const id2 = dnrRuleIdForName('content_rule', empty)
    expect(id1).toBe(id2)
  })

  it('should handle ruleName containing pipe', () => {
    const synthetic = 'rule|name' as SettingId
    const id1 = dnrRuleIdForName('content_rule', synthetic)
    const id2 = dnrRuleIdForName('content_rule', synthetic)
    expect(id1).toBe(id2)
  })

  it('should handle special characters in ruleName', () => {
    const synthetic = 'rule-with-dashes' as SettingId
    const id1 = dnrRuleIdForName('content_rule', synthetic)
    const id2 = dnrRuleIdForName('content_rule', synthetic)
    expect(id1).toBe(id2)
  })

  it('should return positive integer IDs', () => {
    const id = dnrRuleIdForName('content_rule', 'gpc')
    expect(id).toBeGreaterThan(0)
    expect(Number.isInteger(id)).toBe(true)
  })
})
