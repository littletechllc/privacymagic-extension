import '@test/mocks/globals'
import '@test/mocks/web-extension'
import { computeNetworkRuleUpdates, computeDefaultNetworkRuleUpdates } from '@src/background/dnr/network-rules'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import type { SettingId } from '@src/common/setting-ids'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { getDynamicRulesMock } from '@test/mocks/web-extension'

beforeEach(() => {
  jest.clearAllMocks()
  getDynamicRulesMock.mockResolvedValue([])
})

describe('computeNetworkRuleUpdates', () => {
  const category = 'network_rule'
  const domain = 'example.com'

  describe('when setting is not in NETWORK_PROTECTION_DEFS', () => {
    it('should return undefined without calling any chrome APIs', async () => {
      const result = await computeNetworkRuleUpdates(domain, 'audio' as SettingId, true)

      expect(result).toBeUndefined()
      expect(getDynamicRulesMock).not.toHaveBeenCalled()
    })
  })

  describe('when setting is gpc', () => {
    const setting: SettingId = 'gpc'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should not exclude domain when protection is enabled and rules do not exist', async () => {
      getDynamicRulesMock.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      const result = await computeNetworkRuleUpdates(domain, setting, true)

      expect(getDynamicRulesMock).toHaveBeenCalledWith({ ruleIds: [ruleId] })
      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [{
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
            excludedTopDomains: undefined
          }
        }]
      })
    })

    it('should exclude domain when protection is disabled', async () => {
      getDynamicRulesMock.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      const result = await computeNetworkRuleUpdates(domain, setting, false)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [{
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
        }]
      })
    })

    it('should remove domain from excluded list when protection is enabled', async () => {
      const existingRule: chrome.declarativeNetRequest.Rule = {
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
          excludedTopDomains: ['other.com', domain]
        }
      }
      getDynamicRulesMock.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeNetworkRuleUpdates(domain, setting, true)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [{
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
            excludedTopDomains: ['other.com']
          }
        }]
      })
    })

    it('should add domain to excluded list when protection is disabled', async () => {
      const existingRule: chrome.declarativeNetRequest.Rule = {
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
          excludedTopDomains: ['other.com']
        }
      }
      getDynamicRulesMock.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeNetworkRuleUpdates(domain, setting, false)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [{
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
            excludedTopDomains: ['other.com', domain]
          }
        }]
      })
    })
  })

  describe('when setting is css (has multiple rules)', () => {
    const setting: SettingId = 'css'
    const ruleId0 = dnrRuleIdForName(category, `${setting}0`)
    const ruleId1 = dnrRuleIdForName(category, `${setting}1`)

    it('should not exclude domain in any rules when protection is enabled', async () => {
      getDynamicRulesMock.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      const result = await computeNetworkRuleUpdates(domain, setting, true)

      expect(getDynamicRulesMock).toHaveBeenCalledWith({ ruleIds: [ruleId0, ruleId1] })
      expect(result).toEqual({
        removeRuleIds: [ruleId0, ruleId1],
        addRules: [
          {
            id: ruleId0,
            priority: DNR_RULE_PRIORITIES.NETWORK,
            action: {
              type: 'modifyHeaders',
              responseHeaders: [{
                operation: 'append',
                header: 'Content-Security-Policy',
                value: 'style-src-elem https:;'
              }]
            },
            condition: {
              resourceTypes: ALL_RESOURCE_TYPES,
              excludedTopDomains: undefined
            }
          },
          {
            id: ruleId1,
            priority: DNR_RULE_PRIORITIES.NETWORK,
            action: {
              type: 'block'
            },
            condition: {
              resourceTypes: ['stylesheet'],
              excludedTopDomains: undefined
            }
          }
        ]
      })
    })

    it('should exclude domain in all rules when protection is disabled', async () => {
      const existingRule0: chrome.declarativeNetRequest.Rule = {
        id: ruleId0,
        priority: DNR_RULE_PRIORITIES.NETWORK,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [{
            operation: 'append',
            header: 'Content-Security-Policy',
            value: 'style-src-elem https:;'
          }]
        },
        condition: {
          resourceTypes: ALL_RESOURCE_TYPES,
          excludedTopDomains: ['other.com']
        }
      }
      const existingRule1: chrome.declarativeNetRequest.Rule = {
        id: ruleId1,
        priority: DNR_RULE_PRIORITIES.NETWORK,
        action: {
          type: 'block'
        },
        condition: {
          resourceTypes: ['stylesheet'],
          excludedTopDomains: ['other.com']
        }
      }
      getDynamicRulesMock.mockResolvedValue([existingRule0, existingRule1] as chrome.declarativeNetRequest.Rule[])

      const result = await computeNetworkRuleUpdates(domain, setting, false)

      expect(result).toEqual({
        removeRuleIds: [ruleId0, ruleId1],
        addRules: [
          {
            id: ruleId0,
            priority: DNR_RULE_PRIORITIES.NETWORK,
            action: {
              type: 'modifyHeaders',
              responseHeaders: [{
                operation: 'append',
                header: 'Content-Security-Policy',
                value: 'style-src-elem https:;'
              }]
            },
            condition: {
              resourceTypes: ALL_RESOURCE_TYPES,
              excludedTopDomains: ['other.com', domain]
            }
          },
          {
            id: ruleId1,
            priority: DNR_RULE_PRIORITIES.NETWORK,
            action: {
              type: 'block'
            },
            condition: {
              resourceTypes: ['stylesheet'],
              excludedTopDomains: ['other.com', domain]
            }
          }
        ]
      })
    })
  })

  describe('when setting is referrerPolicy (has multiple rules with conditions)', () => {
    const setting: SettingId = 'referrerPolicy'
    const ruleId0 = dnrRuleIdForName(category, `${setting}0`)
    const ruleId1 = dnrRuleIdForName(category, `${setting}1`)

    it('should not exclude domain when protection is enabled, preserving specific conditions', async () => {
      getDynamicRulesMock.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      const result = await computeNetworkRuleUpdates(domain, setting, true)

      expect(result).toEqual({
        removeRuleIds: [ruleId0, ruleId1],
        addRules: [
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
              excludedTopDomains: undefined,
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
              excludedTopDomains: undefined,
              responseHeaders: [{
                header: 'referrer-policy',
                values: ['origin']
              }]
            }
          }
        ]
      })
    })
  })
})

describe('computeDefaultNetworkRuleUpdates', () => {
  it('should return update options for all network rules', () => {
    const result = computeDefaultNetworkRuleUpdates()

    // Should return an array of UpdateRuleOptions, one for each rule
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)

    // Verify the structure of each update option
    for (const updateOption of result) {
      expect(updateOption).toBeDefined()
      expect(updateOption).toHaveProperty('addRules')
      expect(updateOption).toHaveProperty('removeRuleIds')
      expect(Array.isArray(updateOption?.addRules)).toBe(true)
      expect(Array.isArray(updateOption?.removeRuleIds)).toBe(true)
      expect(updateOption?.addRules?.length).toBe(1)
      expect(updateOption?.removeRuleIds?.length).toBe(1)
      expect(updateOption?.addRules?.[0]?.id).toBe(updateOption?.removeRuleIds?.[0])
    }
  })
})
