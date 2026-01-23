import '@test/mocks/globals'
import '@test/mocks/web-extension'
import { computeContentRuleUpdates, computeDefaultContentRuleUpdate } from '@src/background/dnr/content-rules'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import type { ContentSettingId } from '@src/common/setting-ids'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { getDynamicRulesMock } from '@test/mocks/web-extension'

beforeEach(() => {
  jest.clearAllMocks()
  getDynamicRulesMock.mockResolvedValue([])
})

// Helper function to create a content rule for testing
const createContentRule = (
  ruleId: number,
  disabledSettings: ContentSettingId[],
  domain?: string
): chrome.declarativeNetRequest.Rule => {
  const cookieKeyVal = `__pm__disabled_settings=${disabledSettings.join(',')}`
  const headerValue = `${cookieKeyVal}; Secure; SameSite=None; Path=/; Partitioned`
  return {
    id: ruleId,
    priority: DNR_RULE_PRIORITIES.CONTENT_SCRIPTS,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'append',
        header: 'Set-Cookie',
        value: headerValue
      }]
    },
    condition: {
      resourceTypes: ['main_frame', 'sub_frame'],
      ...(domain == null ? { excludedTopDomains: [] } : { topDomains: [domain] })
    }
  }
}

describe('computeContentRuleUpdates', () => {
  const category = 'content_rule'
  const domain = 'example.com'
  const setting: ContentSettingId = 'cpu'

  describe('when setting is not a ContentSettingId', () => {
    it('should return undefined without calling any chrome APIs', async () => {
      const result = await computeContentRuleUpdates(domain, 'ads' as ContentSettingId, false)

      expect(result).toBeUndefined()
      expect(getDynamicRulesMock).not.toHaveBeenCalled()
    })
  })

  describe('when disabling protection for a domain', () => {
    it('should create domain rule and update default rule when no rules exist', async () => {
      const ruleId = dnrRuleIdForName(category, domain)
      const defaultRuleId = dnrRuleIdForName(category, 'default')
      getDynamicRulesMock
        .mockResolvedValueOnce([] as chrome.declarativeNetRequest.Rule[]) // domain rule
        .mockResolvedValueOnce([] as chrome.declarativeNetRequest.Rule[]) // default rule

      const result = await computeContentRuleUpdates(domain, setting, false)

      expect(getDynamicRulesMock).toHaveBeenCalledTimes(2)
      expect(getDynamicRulesMock).toHaveBeenNthCalledWith(1, { ruleIds: [ruleId] })
      expect(getDynamicRulesMock).toHaveBeenNthCalledWith(2, { ruleIds: [defaultRuleId] })
      const expectedDefaultRule = createContentRule(defaultRuleId, [], undefined)
      expectedDefaultRule.condition.excludedTopDomains = [domain]
      expect(result).toEqual({
        removeRuleIds: [ruleId, defaultRuleId],
        addRules: [
          expectedDefaultRule,
          createContentRule(ruleId, [setting], domain)
        ]
      })
    })

    it('should add setting to existing domain rule', async () => {
      const ruleId = dnrRuleIdForName(category, domain)
      const defaultRuleId = dnrRuleIdForName(category, 'default')
      const existingRule = createContentRule(ruleId, ['battery'], domain)
      const existingDefaultRule = createContentRule(defaultRuleId, [], undefined)
      existingDefaultRule.condition.excludedTopDomains = ['other.com']
      getDynamicRulesMock
        .mockResolvedValueOnce([existingRule] as chrome.declarativeNetRequest.Rule[])
        .mockResolvedValueOnce([existingDefaultRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeContentRuleUpdates(domain, setting, false)

      expect(result).toEqual({
        removeRuleIds: [ruleId, defaultRuleId],
        addRules: [
          {
            ...existingDefaultRule,
            condition: {
              ...existingDefaultRule.condition,
              excludedTopDomains: ['other.com', domain]
            }
          },
          createContentRule(ruleId, ['battery', setting], domain)
        ]
      })
    })

    it('should update default rule to exclude domain when adding first disabled setting', async () => {
      const defaultRuleId = dnrRuleIdForName(category, 'default')
      const existingDefaultRule = createContentRule(defaultRuleId, [], undefined)
      existingDefaultRule.condition.excludedTopDomains = undefined
      getDynamicRulesMock
        .mockResolvedValueOnce([] as chrome.declarativeNetRequest.Rule[])
        .mockResolvedValueOnce([existingDefaultRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeContentRuleUpdates(domain, setting, false)

      expect(result).toBeDefined()
      const defaultRule = result?.addRules?.[0]
      expect(defaultRule?.condition.excludedTopDomains).toEqual([domain])
    })
  })

  describe('when enabling protection for a domain', () => {
    it('should remove domain rule and update default rule when removing last disabled setting', async () => {
      const ruleId = dnrRuleIdForName(category, domain)
      const defaultRuleId = dnrRuleIdForName(category, 'default')
      const existingRule = createContentRule(ruleId, [setting], domain)
      const existingDefaultRule = createContentRule(defaultRuleId, [], undefined)
      existingDefaultRule.condition.excludedTopDomains = [domain]
      getDynamicRulesMock
        .mockResolvedValueOnce([existingRule] as chrome.declarativeNetRequest.Rule[])
        .mockResolvedValueOnce([existingDefaultRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeContentRuleUpdates(domain, setting, true)

      expect(result).toEqual({
        removeRuleIds: [ruleId, defaultRuleId],
        addRules: [
          {
            ...existingDefaultRule,
            condition: {
              ...existingDefaultRule.condition,
              excludedTopDomains: undefined
            }
          }
        ]
      })
    })

    it('should remove setting from existing domain rule but keep rule if other settings remain', async () => {
      const ruleId = dnrRuleIdForName(category, domain)
      const defaultRuleId = dnrRuleIdForName(category, 'default')
      const existingRule = createContentRule(ruleId, ['battery', setting], domain)
      const existingDefaultRule = createContentRule(defaultRuleId, [], undefined)
      existingDefaultRule.condition.excludedTopDomains = [domain]
      getDynamicRulesMock
        .mockResolvedValueOnce([existingRule] as chrome.declarativeNetRequest.Rule[])
        .mockResolvedValueOnce([existingDefaultRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeContentRuleUpdates(domain, setting, true)

      expect(result).toEqual({
        removeRuleIds: [ruleId, defaultRuleId],
        addRules: [
          {
            ...existingDefaultRule,
            condition: {
              ...existingDefaultRule.condition,
              excludedTopDomains: [domain] // Still excluded because battery is still disabled
            }
          },
          createContentRule(ruleId, ['battery'], domain)
        ]
      })
    })

    it('should remove domain from default rule excluded list when no settings are disabled', async () => {
      const ruleId = dnrRuleIdForName(category, domain)
      const defaultRuleId = dnrRuleIdForName(category, 'default')
      const existingRule = createContentRule(ruleId, [setting], domain)
      const existingDefaultRule = createContentRule(defaultRuleId, [], undefined)
      existingDefaultRule.condition.excludedTopDomains = ['other.com', domain]
      getDynamicRulesMock
        .mockResolvedValueOnce([existingRule] as chrome.declarativeNetRequest.Rule[])
        .mockResolvedValueOnce([existingDefaultRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeContentRuleUpdates(domain, setting, true)

      const defaultRule = result?.addRules?.[0]
      expect(defaultRule?.condition.excludedTopDomains).toEqual(['other.com'])
    })
  })

  describe('cookie format', () => {
    it('should create cookie with correct format', async () => {
      getDynamicRulesMock
        .mockResolvedValueOnce([] as chrome.declarativeNetRequest.Rule[])
        .mockResolvedValueOnce([] as chrome.declarativeNetRequest.Rule[])

      const result = await computeContentRuleUpdates(domain, setting, false)

      const domainRule = result?.addRules?.[1]
      const cookieValue = domainRule?.action.type === 'modifyHeaders'
        ? domainRule.action.responseHeaders?.find(h => h.header === 'Set-Cookie')?.value
        : undefined
      expect(cookieValue).toBe(`__pm__disabled_settings=${setting}; Secure; SameSite=None; Path=/; Partitioned`)
    })

    it('should handle multiple disabled settings in cookie', async () => {
      const ruleId = dnrRuleIdForName(category, domain)
      const defaultRuleId = dnrRuleIdForName(category, 'default')
      const existingRule = createContentRule(ruleId, ['battery'], domain)
      const existingDefaultRule = createContentRule(defaultRuleId, [], undefined)
      existingDefaultRule.condition.excludedTopDomains = [domain]
      getDynamicRulesMock
        .mockResolvedValueOnce([existingRule] as chrome.declarativeNetRequest.Rule[])
        .mockResolvedValueOnce([existingDefaultRule] as chrome.declarativeNetRequest.Rule[])

      const result = await computeContentRuleUpdates(domain, setting, false)

      const domainRule = result?.addRules?.[1]
      const cookieValue = domainRule?.action.type === 'modifyHeaders'
        ? domainRule.action.responseHeaders?.find(h => h.header === 'Set-Cookie')?.value
        : undefined
      expect(cookieValue).toContain('__pm__disabled_settings=')
      expect(cookieValue).toContain('battery')
      expect(cookieValue).toContain('cpu')
    })
  })
})

describe('computeDefaultContentRuleUpdate', () => {
  it('should create default rule with empty disabled settings', () => {
    const defaultRuleId = dnrRuleIdForName('content_rule', 'default')

    const result = computeDefaultContentRuleUpdate()

    expect(result).toEqual({
      removeRuleIds: [defaultRuleId],
      addRules: [createContentRule(defaultRuleId, [], undefined)]
    })
  })

  it('should create default rule with empty excludedTopDomains', () => {
    const result = computeDefaultContentRuleUpdate()

    const defaultRule = result.addRules?.[0]
    expect(defaultRule?.condition.excludedTopDomains).toEqual([])
  })
})
