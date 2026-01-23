import '@test/mocks/web-extension'
import { updateAllowRules } from '@src/background/dnr/allow-rules'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import type { SettingId } from '@src/common/setting-ids'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Get references to the mocked functions (set up in test/setup.ts)
const mockGetDynamicRules = global.chrome.declarativeNetRequest.getDynamicRules as jest.MockedFunction<(filter?: chrome.declarativeNetRequest.GetRulesFilter) => Promise<chrome.declarativeNetRequest.Rule[]>>
const mockUpdateDynamicRules = global.chrome.declarativeNetRequest.updateDynamicRules as jest.MockedFunction<(options: chrome.declarativeNetRequest.UpdateRuleOptions) => Promise<void>>

beforeEach(() => {
  jest.clearAllMocks()
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

describe('updateAllowRules', () => {
  const category = 'allow_rule'
  const domain = 'example.com'

  describe('when setting is not in BASE_RULES', () => {
    it('should return early without calling any chrome APIs', async () => {
      await updateAllowRules(domain, 'audio' as SettingId, true)

      expect(mockGetDynamicRules).not.toHaveBeenCalled()
      expect(mockUpdateDynamicRules).not.toHaveBeenCalled()
    })
  })

  describe('when setting is masterSwitch', () => {
    const setting: SettingId = 'masterSwitch'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should create new rule when rule does not exist and protection is disabled', async () => {
      mockGetDynamicRules.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      await updateAllowRules(domain, setting, false)

      expect(mockGetDynamicRules).toHaveBeenCalledWith({ ruleIds: [ruleId] })
      expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])]
      })
    })

    it('should remove rule when protection is enabled and rule has only this domain', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])
      mockGetDynamicRules.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      await updateAllowRules(domain, setting, true)

      expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [ruleId],
        addRules: []
      })
    })

    it('should update existing rule when protection is disabled and rule already exists', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com'])
      mockGetDynamicRules.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      await updateAllowRules(domain, setting, false)

      expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com', domain])]
      })
    })

    it('should remove domain from existing rule when protection is enabled', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com', domain, 'another.com'])
      mockGetDynamicRules.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      await updateAllowRules(domain, setting, true)

      expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, ['other.com', 'another.com'])]
      })
    })

    it('should not add duplicate domain when protection is disabled', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])
      mockGetDynamicRules.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      await updateAllowRules(domain, setting, false)

      expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.MASTER_SWITCH, [domain])]
      })
    })
  })

  describe('when setting is ads', () => {
    const setting: SettingId = 'ads'
    const ruleId = dnrRuleIdForName(category, setting)

    it('should create new rule when rule does not exist and protection is disabled', async () => {
      mockGetDynamicRules.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[])

      await updateAllowRules(domain, setting, false)

      expect(mockGetDynamicRules).toHaveBeenCalledWith({ ruleIds: [ruleId] })
      expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [ruleId],
        addRules: [createRule(ruleId, DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS, [domain])]
      })
    })

    it('should remove rule when protection is enabled and rule has only this domain', async () => {
      const existingRule = createRule(ruleId, DNR_RULE_PRIORITIES.BLOCKER_EXCEPTIONS, [domain])
      mockGetDynamicRules.mockResolvedValue([existingRule] as chrome.declarativeNetRequest.Rule[])

      await updateAllowRules(domain, setting, true)

      expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [ruleId],
        addRules: []
      })
    })
  })
})
