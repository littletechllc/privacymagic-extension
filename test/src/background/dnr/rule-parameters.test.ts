import { describe, it, expect, beforeEach } from '@jest/globals'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

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
    const id1 = dnrRuleIdForName('content_rule', 'test_rule')
    const id2 = dnrRuleIdForName('content_rule', 'test_rule')
    expect(id1).toBe(id2)
  })

  it('should return different IDs for different categories', () => {
    const id1 = dnrRuleIdForName('content_rule', 'same_rule')
    const id2 = dnrRuleIdForName('network_rule', 'same_rule')
    expect(id1).not.toBe(id2)
  })

  it('should return different IDs for different rule names in the same category', () => {
    const id1 = dnrRuleIdForName('content_rule', 'rule1')
    const id2 = dnrRuleIdForName('content_rule', 'rule2')
    expect(id1).not.toBe(id2)
  })

  it('should return sequential IDs for new category/name combinations', () => {
    // Get a baseline ID
    const baselineId = dnrRuleIdForName('content_rule', 'baseline')

    // Get IDs for new combinations - they should be sequential
    const id1 = dnrRuleIdForName('content_rule', 'new1')
    const id2 = dnrRuleIdForName('content_rule', 'new2')
    const id3 = dnrRuleIdForName('content_rule', 'new3')

    expect(id1).toBe(baselineId + 1)
    expect(id2).toBe(baselineId + 2)
    expect(id3).toBe(baselineId + 3)
  })

  it('should handle empty ruleName', () => {
    const id1 = dnrRuleIdForName('content_rule', '')
    const id2 = dnrRuleIdForName('content_rule', '')
    expect(id1).toBe(id2)
  })

  it('should handle ruleName containing pipe', () => {
    const id1 = dnrRuleIdForName('content_rule', 'rule|name')
    const id2 = dnrRuleIdForName('content_rule', 'rule|name')
    expect(id1).toBe(id2)
  })

  it('should handle special characters in ruleName', () => {
    const id1 = dnrRuleIdForName('content_rule', 'rule-with-dashes')
    const id2 = dnrRuleIdForName('content_rule', 'rule-with-dashes')
    expect(id1).toBe(id2)
  })

  it('should return positive integer IDs', () => {
    const id = dnrRuleIdForName('content_rule', 'test')
    expect(id).toBeGreaterThan(0)
    expect(Number.isInteger(id)).toBe(true)
  })
})
