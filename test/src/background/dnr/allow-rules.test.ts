import '@test/mocks/globals'
import '@test/mocks/web-extension'
import { computeAllowRules } from '@src/background/dnr/allow-rules'
import { RULE_DOMAIN_PLACEHOLDER } from '@src/background/dnr/rule-domains'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import type { SettingId } from '@src/common/setting-ids'
import { describe, it, expect } from '@jest/globals'

const category = 'allow_rule' as const

const allowRule = (
  ruleId: number,
  priority: DNR_RULE_PRIORITIES,
  topDomains: string[]
): chrome.declarativeNetRequest.Rule => ({
  id: ruleId,
  priority,
  action: { type: 'allow' },
  condition: {
    topDomains,
    resourceTypes: ALL_RESOURCE_TYPES
  }
})

describe('computeAllowRules', () => {
  const domain = 'example.com'

  describe('when setting is not a blocker setting', () => {
    it('should return empty array', () => {
      const result = computeAllowRules('audio' as SettingId, [domain])
      expect(result).toEqual([])
    })
  })

  describe('when setting is masterSwitch', () => {
    const setting: SettingId = 'masterSwitch'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should return one allow rule with given topDomains', () => {
      const result = computeAllowRules(setting, [domain])

      expect(result).toEqual([
        allowRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])
      ])
    })

    it('should use placeholder topDomains when no real domains (manager normalization)', () => {
      const result = computeAllowRules(setting, [RULE_DOMAIN_PLACEHOLDER])

      expect(result).toEqual([
        allowRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [RULE_DOMAIN_PLACEHOLDER])
      ])
    })

    it('should pass multiple domains through unchanged', () => {
      const result = computeAllowRules(setting, ['other.com', domain])

      expect(result).toEqual([
        allowRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com', domain])
      ])
    })
  })

  describe('when setting is ads', () => {
    const setting: SettingId = 'ads'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should return one allow rule with blocker exception priority', () => {
      const result = computeAllowRules(setting, [domain])

      expect(result).toEqual([
        allowRule(ruleId, DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS, [domain])
      ])
    })

    it('should use placeholder topDomains when none are disabled for ads (manager normalization)', () => {
      const result = computeAllowRules(setting, [RULE_DOMAIN_PLACEHOLDER])

      expect(result).toEqual([
        allowRule(ruleId, DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS, [RULE_DOMAIN_PLACEHOLDER])
      ])
    })
  })
})
