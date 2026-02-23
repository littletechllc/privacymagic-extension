import '@test/mocks/globals'
import { getDynamicRulesMock, storageLocalGetMock, updateDynamicRulesMock } from '@test/mocks/web-extension'
import { updateRules, setupRules } from '@src/background/dnr/rule-manager'
import { SETTINGS_KEY_PREFIX } from '@src/common/settings'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NETWORK_PROTECTION_DEFS } from '@src/background/dnr/network-rules'

const countNetworkRules = (): number => {
  let count = 0
  for (const rules of Object.values(NETWORK_PROTECTION_DEFS)) {
    count += rules.length
  }
  return count
}

const totalDefaultNetworkRulesCount = countNetworkRules()
const totalDefaultContentRulesCount = 1

const getUpdateDynamicRulesCall = () => {
  expect(updateDynamicRulesMock).toHaveBeenCalledTimes(1)
  const call = updateDynamicRulesMock.mock.calls[0]?.[0]
  expect(call).toHaveProperty('removeRuleIds')
  expect(call).toHaveProperty('addRules')
  return call as { removeRuleIds: number[], addRules: chrome.declarativeNetRequest.Rule[] }
}

const expectRuleCounts = (call: { removeRuleIds: number[], addRules: chrome.declarativeNetRequest.Rule[] }, expectedRemoveCount: number, expectedAddCount: number): void => {
  expect(call.removeRuleIds.length).toBe(expectedRemoveCount)
  expect(call.addRules.length).toBe(expectedAddCount)
}

beforeEach(() => {
  jest.clearAllMocks()
  // Mock storage.local.get() and
  // chrome.declarativeNetRequest.getDynamicRules
  // to return empty results by default
  storageLocalGetMock.mockResolvedValue({})
  getDynamicRulesMock.mockResolvedValue([])
})

describe('updateRules', () => {
  const domain = 'example.com'

  it('should call updateDynamicRules once for gpc with batched content and network rules', async () => {
    getDynamicRulesMock
      .mockResolvedValueOnce([]) // content rule for domain
      .mockResolvedValueOnce([]) // content rule default
      .mockResolvedValueOnce([]) // network rule for gpc

    await updateRules(domain, 'gpc', true)

    const call = getUpdateDynamicRulesCall()
    expect(Array.isArray(call.removeRuleIds)).toBe(true)
    expect(Array.isArray(call.addRules)).toBe(true)
    // Content rules: remove 2 IDs (domain + default), add 1 rule (default only, since protection enabled removes the setting)
    // Network rule: remove 1 ID, add 1 rule (updated without domain in excludedTopDomains)
    expectRuleCounts(call, 3, 2)
  })

  it('should call updateDynamicRules once for masterSwitch with batched content and allow rules', async () => {
    getDynamicRulesMock
      .mockResolvedValueOnce([]) // content rule for domain
      .mockResolvedValueOnce([]) // content rule default
      .mockResolvedValueOnce([]) // allow rule for masterSwitch

    await updateRules(domain, 'masterSwitch', true)

    const call = getUpdateDynamicRulesCall()
    // Content rules: remove 2 IDs (domain + default), add 1 rule (default only, since protection enabled removes the setting)
    // Allow rule: remove 1 ID, add 0 rules (rule removed when protection enabled and topDomains becomes empty)
    expectRuleCounts(call, 3, 1)
  })

  it('should call updateDynamicRules once for math with only content rule', async () => {
    getDynamicRulesMock
      .mockResolvedValueOnce([]) // content rule for domain
      .mockResolvedValueOnce([]) // content rule default

    await updateRules(domain, 'math', true)

    const call = getUpdateDynamicRulesCall()
    // Content rules: remove 2 IDs (domain + default), add 1 rule (default only, since protection enabled removes the setting)
    expectRuleCounts(call, 2, 1)
  })

  it('should call updateDynamicRules once for ads with only allow rule', async () => {
    getDynamicRulesMock.mockResolvedValueOnce([]) // allow rule for ads

    await updateRules(domain, 'ads', true)

    const call = getUpdateDynamicRulesCall()
    // Allow rule: remove 1 ID, add 0 rules (rule removed when protection enabled and topDomains becomes empty)
    expectRuleCounts(call, 1, 0)
  })

  it('should call updateDynamicRules once for queryParameters with only network rule', async () => {
    getDynamicRulesMock.mockResolvedValueOnce([]) // network rule for queryParameters

    await updateRules(domain, 'queryParameters', true)

    const call = getUpdateDynamicRulesCall()
    // Network rule: remove 1 ID, add 1 rule (updated without domain in excludedTopDomains)
    expectRuleCounts(call, 1, 1)
  })
})

describe('setupRules', () => {
  it('should call updateDynamicRules once with all batched rule updates', async () => {
    const domain = 'example.com'
    // Mock stored settings:
    // - battery: ContentSettingId only
    // - gpc: Both ContentSettingId and NetworkSettingId
    // - queryParameters: NetworkSettingId only
    const storageData: Record<string, unknown> = {
      [`${SETTINGS_KEY_PREFIX}:${domain}:battery`]: false, // ContentSettingId only - protection disabled
      [`${SETTINGS_KEY_PREFIX}:${domain}:gpc`]: false, // Both ContentSettingId and NetworkSettingId - protection disabled
      [`${SETTINGS_KEY_PREFIX}:${domain}:queryParameters`]: false // NetworkSettingId only - protection disabled
    }
    storageLocalGetMock.mockResolvedValue(storageData)
    getDynamicRulesMock.mockResolvedValue([])

    await setupRules()

    expect(storageLocalGetMock).toHaveBeenCalled()
    const call = getUpdateDynamicRulesCall()
    expect(Array.isArray(call.removeRuleIds)).toBe(true)
    expect(Array.isArray(call.addRules)).toBe(true)

    // Default rules: 1 content + totalDefaultNetworkRulesCount network
    // Stored settings (all on same domain 'example.com', all protection disabled):
    //   - battery: content rule removes [domainContentRuleId, defaultContentRuleId], adds [defaultRule, domainRule]
    //   - gpc: content rule removes [domainContentRuleId, defaultContentRuleId], adds [defaultRule, domainRule]
    //   - gpc: network rule removes [gpcNetworkRuleId], adds [gpcNetworkRule] (same ID as default, deduplicated)
    //   - queryParameters: network rule removes [queryParametersNetworkRuleId], adds [queryParametersNetworkRule] (same ID as default, deduplicated)
    // removeRuleIds deduplicated: 1 (default content, appears 3 times) + totalDefaultNetworkRulesCount (default network, includes gpc and queryParameters IDs) + 1 (domain content, appears 2 times) = totalDefaultNetworkRulesCount + 2
    // addRules deduplicated: 1 (default content, last wins) + totalDefaultNetworkRulesCount (default network) + 1 (domain content with battery+gpc, last wins) + 1 (gpc network, last wins, replaces default) + 1 (queryParameters network, last wins, replaces default) = totalDefaultNetworkRulesCount + 4
    // But gpc and queryParameters network rules replace their defaults, so: totalDefaultNetworkRulesCount + 2
    // +1 remove and +1 add from remote config (google.com: css, iframe) in test fetch mock
    expectRuleCounts(call, totalDefaultNetworkRulesCount + 3, totalDefaultNetworkRulesCount + 3)
    // Verify removeRuleIds are deduplicated (no duplicates)
    const uniqueRemoveIds = new Set(call.removeRuleIds)
    expect(uniqueRemoveIds.size).toBe(call.removeRuleIds.length)
  })

  it('should call updateDynamicRules once for multiple stored settings', async () => {
    // Mock storage to return settings in the format: key is "_SETTINGS_:domain:settingId", value is boolean
    const storageData: Record<string, unknown> = {
      [`${SETTINGS_KEY_PREFIX}:example.com:gpc`]: true, // protection enabled
      [`${SETTINGS_KEY_PREFIX}:test.com:css`]: false, // protection disabled
      [`${SETTINGS_KEY_PREFIX}:another.com:masterSwitch`]: true // protection enabled
    }
    storageLocalGetMock.mockResolvedValue(storageData)
    getDynamicRulesMock.mockResolvedValue([])

    await setupRules()

    expect(storageLocalGetMock).toHaveBeenCalled()
    const call = getUpdateDynamicRulesCall()

    // Default rules: 1 content + totalDefaultNetworkRulesCount network
    // Stored settings:
    //   - gpc (enabled): content rule removes [example.comContentRuleId, defaultContentRuleId], adds [defaultRule]
    //     - network rule removes [gpcNetworkRuleId], adds [gpcNetworkRule] (same ID as default, deduplicated)
    //   - css (disabled): content rule only (css has no network rules in NETWORK_PROTECTION_DEFS when commented out)
    //     - content rule removes [test.comContentRuleId, defaultContentRuleId], adds [defaultRule, test.comRule]
    //   - masterSwitch (enabled): content rule removes [another.comContentRuleId, defaultContentRuleId], adds [defaultRule]
    //     - allow rule removes [masterSwitchAllowRuleId], adds [] (empty topDomains)
    // Remote config adds google.com: css, iframe (one domain, two settings → same content rule ID removed once after dedupe).
    // removeRuleIds deduplicated: 1 (default content) + totalDefaultNetworkRulesCount (default network) + 4 (domain content: example, test, another, google) + 1 (masterSwitch allow) = totalDefaultNetworkRulesCount + 6, but one fewer unique after dedupe when google.com appears twice (css, iframe).
    // addRules: default content + default network + 1 domain content (test.com) + gpc network; css has no network rules when commented out, so one fewer add than older formula.
    expectRuleCounts(call, totalDefaultNetworkRulesCount + 5, totalDefaultNetworkRulesCount + 2)
    // Verify removeRuleIds are deduplicated
    const uniqueRemoveIds = new Set(call.removeRuleIds)
    expect(uniqueRemoveIds.size).toBe(call.removeRuleIds.length)
  })

  it('should call updateDynamicRules once even when getAllSettings returns empty', async () => {
    // Empty storage means getAllSettings returns empty array
    storageLocalGetMock.mockResolvedValue({})
    getDynamicRulesMock.mockResolvedValue([])

    await setupRules()

    expect(storageLocalGetMock).toHaveBeenCalled()
    const call = getUpdateDynamicRulesCall()

    // Only default rules: 1 content + totalDefaultNetworkRulesCount network
    // +1 remove and +1 add from remote config (google.com: css, iframe) in test fetch mock
    expectRuleCounts(call, totalDefaultContentRulesCount + totalDefaultNetworkRulesCount + 1, totalDefaultContentRulesCount + totalDefaultNetworkRulesCount + 1)
    // Verify removeRuleIds are deduplicated
    const uniqueRemoveIds = new Set(call.removeRuleIds)
    expect(uniqueRemoveIds.size).toBe(call.removeRuleIds.length)
  })
})

