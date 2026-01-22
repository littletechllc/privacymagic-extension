import '@test/mocks/globals'
import { getSessionRulesMock, storageLocalGetMock, updateSessionRulesMock } from '@test/mocks/web-extension'
import { updateRules, setupRules, clearRules } from '@src/background/dnr/rule-manager'
import { SETTINGS_KEY_PREFIX } from '@src/common/settings'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NETWORK_PROTECTION_DEFS } from '@src/background/dnr/network-rules'

const countRules = () : number => {
  let count = 0
  for (const rules of Object.values(NETWORK_PROTECTION_DEFS)) {
    count += rules.length
  }
  return count
}

beforeEach(() => {
  jest.clearAllMocks()
  // Mock storage.local.get() and
  // chrome.declarativeNetRequest.getSessionRules
  // to return empty results by default
  storageLocalGetMock.mockResolvedValue({})
  getSessionRulesMock.mockResolvedValue([])
})

describe('updateRules', () => {
  const domain = 'example.com'

  it('should call updateContentRule, updateNetworkRules, and updateAllowRules for gpc', async () => {
    await updateRules(domain, 'gpc', true)

    // updateContentRule always calls updateSessionRules for 'gpc' (1 call)
    // updateNetworkRules calls updateSessionRules for 'gpc' (1 call)
    // updateAllowRules returns early for 'gpc' since it's not in BASE_RULES (0 calls)
    // We verify that updateSessionRules was called twice to confirm execution.
    expect(updateSessionRulesMock).toHaveBeenCalledTimes(2)
  })

  it('should call updateSessionRules twice for masterSwitch', async () => {
    await updateRules(domain, 'masterSwitch', true)

    // updateContentRule calls updateSessionRules for 'masterSwitch' since it's a ContentSettingId (doesn't return early) (1 call)
    // updateNetworkRules returns early for 'masterSwitch' since it's not in NETWORK_PROTECTION_DEFS (0 calls)
    // updateAllowRules calls updateSessionRules for 'masterSwitch' since it's in BASE_RULES (doesn't return early) (1 call)
    // Total: 2 calls
    expect(updateSessionRulesMock).toHaveBeenCalledTimes(2)
  })

  it('should call updateSessionRules once for math', async () => {
    await updateRules(domain, 'math', true)

    // updateContentRule calls updateSessionRules for 'math' since it's a ContentSettingId (doesn't return early) (1 call)
    // updateNetworkRules returns early for 'math' since it's not in NETWORK_PROTECTION_DEFS (0 calls)
    // updateAllowRules returns early for 'math' since it's not in BASE_RULES (0 calls)
    // Total: 1 call
    expect(updateSessionRulesMock).toHaveBeenCalledTimes(1)
  })

  it('should call updateSessionRules once for ads', async () => {
    await updateRules(domain, 'ads', true)

    // updateContentRule returns early for 'ads' since it's not a ContentSettingId (0 calls)
    // updateNetworkRules returns early for 'ads' since it's not in NETWORK_PROTECTION_DEFS (0 calls)
    // updateAllowRules calls updateSessionRules for 'ads' since it's in BASE_RULES (doesn't return early) (1 call)
    // Total: 1 call
    expect(updateSessionRulesMock).toHaveBeenCalledTimes(1)
  })

  it('should call updateSessionRules once for queryParameters', async () => {
    await updateRules(domain, 'queryParameters', true)

    // updateContentRule returns early for 'queryParameters' since it's not a ContentSettingId (0 calls)
    // updateNetworkRules calls updateSessionRules for 'queryParameters' since it's in NETWORK_PROTECTION_DEFS (doesn't return early) (1 call)
    // updateAllowRules returns early for 'queryParameters' since it's not in BASE_RULES (0 calls)
    // Total: 1 call
    expect(updateSessionRulesMock).toHaveBeenCalledTimes(1)
  })
})

describe('setupRules', () => {
  const totalDefaultNetworkRulesCount = countRules()
  const totalDefaultContentRulesCount = 1

  it('should apply stored settings to session rules', async () => {
    const domain = 'example.com'
    // Mock stored settings:
    // - battery: ContentSettingId only -> 1 call from updateContentRule
    // - gpc: Both ContentSettingId and NetworkSettingId -> 2 calls (1 from updateContentRule, 1 from updateNetworkRules)
    // - queryParameters: NetworkSettingId only -> 1 call from updateNetworkRules
    // Total from updateRules: 4 calls
    const storageData: Record<string, unknown> = {
      [`${SETTINGS_KEY_PREFIX}:${domain}:battery`]: false, // ContentSettingId only - protection disabled
      [`${SETTINGS_KEY_PREFIX}:${domain}:gpc`]: false, // Both ContentSettingId and NetworkSettingId - protection disabled
      [`${SETTINGS_KEY_PREFIX}:${domain}:queryParameters`]: false // NetworkSettingId only - protection disabled
    }
    storageLocalGetMock.mockResolvedValue(storageData)
    getSessionRulesMock.mockResolvedValue([])

    const initialCallCount = updateSessionRulesMock.mock.calls.length
    await setupRules()

    // Verify that updateSessionRules was called for setup and stored settings
    // setupDefaultContentRule: 1 call
    // setupDefaultNetworkRules: 12 calls (one per network rule)
    // updateRules for stored settings: 4 calls
    //   - battery: updateContentRule (1 call)
    //   - gpc: updateContentRule (1 call) + updateNetworkRules (1 call)
    //   - queryParameters: updateNetworkRules (1 call)
    const finalCallCount = updateSessionRulesMock.mock.calls.length
    expect(finalCallCount - initialCallCount).toBe(totalDefaultNetworkRulesCount + totalDefaultContentRulesCount + 4)

    // Verify storage was called to get all settings
    expect(storageLocalGetMock).toHaveBeenCalled()
  })

  it('should call updateRules for each setting returned by getAllSettings', async () => {
    // Mock storage to return settings in the format: key is "_SETTINGS_:domain:settingId", value is boolean
    const storageData: Record<string, unknown> = {
      [`${SETTINGS_KEY_PREFIX}:example.com:gpc`]: true,
      [`${SETTINGS_KEY_PREFIX}:test.com:css`]: false,
      [`${SETTINGS_KEY_PREFIX}:another.com:masterSwitch`]: true
    }
    storageLocalGetMock.mockResolvedValue(storageData)
    getSessionRulesMock.mockResolvedValue([])

    const initialCallCount = updateSessionRulesMock.mock.calls.length
    await setupRules()

    // Verify storage was called
    expect(storageLocalGetMock).toHaveBeenCalled()
    // Verify that updateSessionRules was called for each stored setting
    // gpc: updateContentRule (1 call) + updateNetworkRules (1 call) = 2 calls
    // css: updateContentRule (1 call) + updateNetworkRules (1 call) = 2 calls
    // masterSwitch: updateContentRule (1 call) + updateAllowRules (1 call) = 2 calls
    // Total from updateRules: 6 calls
    // Plus setup: setupDefaultContentRule + setupDefaultNetworkRules
    // Total: totalDefaultContentRulesCount + totalDefaultNetworkRulesCount + 6
    const finalCallCount = updateSessionRulesMock.mock.calls.length
    expect(finalCallCount - initialCallCount).toBe(totalDefaultContentRulesCount + totalDefaultNetworkRulesCount + 6)
  })

  it('should not call updateRules when getAllSettings returns empty array', async () => {
    // Empty storage means getAllSettings returns empty array
    storageLocalGetMock.mockResolvedValue({})

    const initialCallCount = updateSessionRulesMock.mock.calls.length
    await setupRules()

    // setupDefaultContentRule and setupDefaultNetworkRules should still be called
    // but updateRules should not be called for any settings
    expect(storageLocalGetMock).toHaveBeenCalled()
    // The call count should only increase from setup functions, not from updateRules
    // Total: setupDefaultContentRule (1) + setupDefaultNetworkRules
    const finalCallCount = updateSessionRulesMock.mock.calls.length
    expect(finalCallCount - initialCallCount).toBe(totalDefaultContentRulesCount + totalDefaultNetworkRulesCount)
  })
})

// TODO: Add test to verify that setupRules calls individual setup functions
// before calling updateRules for each setting

describe('clearRules', () => {
  it('should get all session rules', async () => {
    await clearRules()

    expect(getSessionRulesMock).toHaveBeenCalledTimes(1)
    expect(getSessionRulesMock).toHaveBeenCalledWith()
  })

  it('should remove all session rules', async () => {
    const rules: chrome.declarativeNetRequest.Rule[] = [
      { id: 1, action: { type: 'block' }, condition: {} },
      { id: 2, action: { type: 'allow' }, condition: {} },
      { id: 3, action: { type: 'redirect', redirect: { url: 'https://example.com' } }, condition: {} }
    ]
    getSessionRulesMock.mockResolvedValue(rules)

    await clearRules()

    expect(updateSessionRulesMock).toHaveBeenCalledTimes(1)
    expect(updateSessionRulesMock).toHaveBeenCalledWith({
      removeRuleIds: [1, 2, 3]
    })
  })

  it('should handle empty session rules', async () => {
    getSessionRulesMock.mockResolvedValue([])

    await clearRules()

    expect(updateSessionRulesMock).toHaveBeenCalledTimes(1)
    expect(updateSessionRulesMock).toHaveBeenCalledWith({
      removeRuleIds: []
    })
  })
})
