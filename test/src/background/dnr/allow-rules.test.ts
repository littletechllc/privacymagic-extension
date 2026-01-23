import '@test/mocks/web-extension'
import { computeAllowRuleUpdates } from '@src/background/dnr/allow-rules'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import type { SettingId } from '@src/common/setting-ids'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { getDynamicRulesMock } from '@test/mocks/web-extension'

beforeEach(() => {
  jest.clearAllMocks()
  getDynamicRulesMock.mockResolvedValue([])
})

// Helper function to create a rule for testing
const createRule = (
  ruleId: number,
  priority: DNR_RULE_PRIORITIES,
  topDomains: string[] | undefined
): chrome.declarativeNetRequest.Rule => ({
  id: ruleId,
  priority,
  action: { type: 'allow' },
  condition: {
    topDomains,
    resourceTypes: ALL_RESOURCE_TYPES
  }
})

describe('computeAllowRuleUpdates', () => {
  const category = 'allow_rule'
  const domain = 'example.com'

  describe('when setting is not in BASE_RULES', () => {
    it('should return undefined without calling any chrome APIs', async () => {
      const result = await computeAllowRuleUpdates(domain, 'audio' as SettingId, true)

      expect(result).toBeUndefined()
      expect(getDynamicRulesMock).not.toHaveBeenCalled()
    })
  })

  describe('when setting is masterSwitch', () => {
    const setting: SettingId = 'masterSwitch'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should create new rule when rule does not exist and protection is disabled', async () => {
      getDynamicRulesMock.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      const result = await computeAllowRuleUpdates(domain, setting, false)

      expect(getDynamicRulesMock).toHaveBeenCalledWith({ ruleIds: [ruleId] })
      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])]
      })
    })

    it('should remove rule when protection is enabled and rule has only this domain', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])
      getDynamicRulesMock.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeAllowRuleUpdates(domain, setting, true)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: []
      })
    })

    it('should update existing rule when protection is disabled and rule already exists', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com'])
      getDynamicRulesMock.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeAllowRuleUpdates(domain, setting, false)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com', domain])]
      })
    })

    it('should remove domain from existing rule when protection is enabled', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com', domain, 'another.com'])
      getDynamicRulesMock.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeAllowRuleUpdates(domain, setting, true)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com', 'another.com'])]
      })
    })

    it('should not add duplicate domain when protection is disabled', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])
      getDynamicRulesMock.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeAllowRuleUpdates(domain, setting, false)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])]
      })
    })
  })

  describe('when setting is ads', () => {
    const setting: SettingId = 'ads'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should create new rule when rule does not exist and protection is disabled', async () => {
      getDynamicRulesMock.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      const result = await computeAllowRuleUpdates(domain, setting, false)

      expect(getDynamicRulesMock).toHaveBeenCalledWith({ ruleIds: [ruleId] })
      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS, [domain])]
      })
    })

    it('should remove rule when protection is enabled and rule has only this domain', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS, [domain])
      getDynamicRulesMock.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeAllowRuleUpdates(domain, setting, true)

      expect(result).toEqual({
        removeRuleIds: [ruleId],
        addRules: []
      })
    })
  })
})
