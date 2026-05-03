import '@test/mocks/globals'
import '@test/mocks/web-extension'
import { computeNetworkRules } from '@src/background/dnr/network-rules'
import { RULE_DOMAIN_PLACEHOLDER } from '@src/background/dnr/rule-domains'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import type { SettingId } from '@src/common/setting-ids'
import { describe, it, expect } from '@jest/globals'

const category = 'network_rule' as const

describe('computeNetworkRules', () => {
  const domain = 'example.com'

  describe('when setting is not a network setting', () => {
    it('should return empty array', () => {
      const result = computeNetworkRules('audio' as SettingId, [RULE_DOMAIN_PLACEHOLDER])
      expect(result).toEqual([])
    })
  })

  describe('when setting is gpc', () => {
    const setting: SettingId = 'gpc'
    const ruleId = dnrRuleIdForName(category, setting, 0)

    it('should emit one rule with placeholder excludedTopDomains when no real domains are disabled', () => {
      const result = computeNetworkRules(setting, [RULE_DOMAIN_PLACEHOLDER])

      expect(result).toEqual([{
        id: ruleId,
        priority: DNR_RULE_PRIORITIES.NETWORK,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { operation: 'set', header: 'Sec-GPC', value: '1' }
          ]
        },
        condition: {
          resourceTypes: ALL_RESOURCE_TYPES,
          excludedTopDomains: [RULE_DOMAIN_PLACEHOLDER]
        }
      }])
    })

    it('should pass disabled domains as excludedTopDomains', () => {
      const result = computeNetworkRules(setting, [domain])

      expect(result).toEqual([{
        id: ruleId,
        priority: DNR_RULE_PRIORITIES.NETWORK,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { operation: 'set', header: 'Sec-GPC', value: '1' }
          ]
        },
        condition: {
          resourceTypes: ALL_RESOURCE_TYPES,
          excludedTopDomains: [domain]
        }
      }])
    })

    it('should preserve full excluded list', () => {
      const result = computeNetworkRules(setting, ['other.com', domain])

      expect(result[0]?.condition.excludedTopDomains).toEqual(['other.com', domain])
    })
  })

  describe('when setting is referrerPolicy (multiple partial rules)', () => {
    const setting: SettingId = 'referrerPolicy'
    const ruleId0 = dnrRuleIdForName(category, setting, 0)
    const ruleId1 = dnrRuleIdForName(category, setting, 1)

    it('should emit both rules with shared excludedTopDomains', () => {
      const result = computeNetworkRules(setting, [RULE_DOMAIN_PLACEHOLDER])

      expect(result).toEqual([
        {
          id: ruleId0,
          priority: DNR_RULE_PRIORITIES.NETWORK,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [{
              operation: 'set',
              header: 'referrer-policy',
              value: 'strict-origin-when-cross-origin'
            }]
          },
          condition: {
            resourceTypes: ALL_RESOURCE_TYPES,
            excludedTopDomains: [RULE_DOMAIN_PLACEHOLDER],
            excludedResponseHeaders: [{
              header: 'referrer-policy',
              values: ['no-referrer', 'origin', 'same-origin', 'strict-origin']
            }]
          }
        },
        {
          id: ruleId1,
          priority: DNR_RULE_PRIORITIES.NETWORK,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [{
              operation: 'set',
              header: 'referrer-policy',
              value: 'strict-origin'
            }]
          },
          condition: {
            resourceTypes: ALL_RESOURCE_TYPES,
            excludedTopDomains: [RULE_DOMAIN_PLACEHOLDER],
            responseHeaders: [{
              header: 'referrer-policy',
              values: ['origin']
            }]
          }
        }
      ])
    })
  })
})
