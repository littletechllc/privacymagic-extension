import '@test/mocks/globals'
import '@test/mocks/web-extension'
import { updateNetworkRules, setupDefaultNetworkRules } from '@src/background/dnr/network-rules'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import type { SettingId } from '@src/common/setting-ids'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Get references to the mocked functions
const mockGetSessionRules = global.chrome.declarativeNetRequest.getSessionRules as jest.MockedFunction<(filter?: chrome.declarativeNetRequest.GetRulesFilter) => Promise<chrome.declarativeNetRequest.Rule[]>>
const mockUpdateSessionRules = global.chrome.declarativeNetRequest.updateSessionRules as jest.MockedFunction<(options: chrome.declarativeNetRequest.UpdateRuleOptions) => Promise<void>>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('updateNetworkRules', () => {
  const category = 'network_rule'
  const domain = 'example.com'

  describe('when setting is not in NETWORK_PROTECTION_DEFS', () => {
    it('should return early without calling any chrome APIs', async () => {
      await updateNetworkRules(domain, 'audio' as SettingId, true)

      expect(mockGetSessionRules).not.toHaveBeenCalled()
      expect(mockUpdateSessionRules).not.toHaveBeenCalled()
    })
  })

  describe('when setting is gpc', () => {
    const setting: SettingId = 'gpc'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should not exclude domain when protection is enabled and rules do not exist', async () => {
      mockGetSessionRules.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      await updateNetworkRules(domain, setting, true)

      expect(mockGetSessionRules).toHaveBeenCalledWith({ ruleIds: [ruleId] })
      expect(mockUpdateSessionRules).toHaveBeenCalledWith({
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
      mockGetSessionRules.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      await updateNetworkRules(domain, setting, false)

      expect(mockUpdateSessionRules).toHaveBeenCalledWith({
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
      mockGetSessionRules.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      await updateNetworkRules(domain, setting, true)

      expect(mockUpdateSessionRules).toHaveBeenCalledWith({
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
      mockGetSessionRules.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      await updateNetworkRules(domain, setting, false)

      expect(mockUpdateSessionRules).toHaveBeenCalledWith({
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
      mockGetSessionRules.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      await updateNetworkRules(domain, setting, true)

      expect(mockGetSessionRules).toHaveBeenCalledWith({ ruleIds: [ruleId0, ruleId1] })
      expect(mockUpdateSessionRules).toHaveBeenCalledWith({
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
      mockGetSessionRules.mockResolvedValue([existingRule0, existingRule1] as chrome.declarativeNetRequest.Rule[])

      await updateNetworkRules(domain, setting, false)

      expect(mockUpdateSessionRules).toHaveBeenCalledWith({
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
      mockGetSessionRules.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      await updateNetworkRules(domain, setting, true)

      expect(mockUpdateSessionRules).toHaveBeenCalledWith({
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

describe('setupDefaultNetworkRules', () => {
  it('should set up all network rules', async () => {
    await setupDefaultNetworkRules()

    // Should call updateSessionRules for each rule in each setting
    // We can't easily count exact calls without knowing all settings, but we can verify it was called
    expect(mockUpdateSessionRules).toHaveBeenCalled()

    // Verify the structure of calls - each should have addRules and removeRuleIds
    const calls = mockUpdateSessionRules.mock.calls
    for (const call of calls) {
      const options = call[0]
      expect(options).toHaveProperty('addRules')
      expect(options).toHaveProperty('removeRuleIds')
      expect(Array.isArray(options.addRules)).toBe(true)
      expect(Array.isArray(options.removeRuleIds)).toBe(true)
      expect(options.addRules?.length).toBe(1)
      expect(options.removeRuleIds?.length).toBe(1)
      expect(options.addRules?.[0]?.id).toBe(options.removeRuleIds?.[0])
    }
  })
})
