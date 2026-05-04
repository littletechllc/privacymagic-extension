import '@test/mocks/globals'
import '@test/mocks/web-extension'
import { updateRulesForSetting, updateRulesForAllSettings } from '@src/background/dnr/rule-manager'
import { RULE_DOMAIN_PLACEHOLDER } from '@src/background/dnr/rule-domains'
import { NETWORK_PROTECTION_DEFS } from '@src/background/dnr/network-rule-defs'
import { DNR_RULE_PRIORITIES } from '@src/background/dnr/rule-parameters'
import {
  ALL_SETTING_IDS,
  isBlockerSetting,
  isContentSetting,
  isNetworkSetting,
  type SettingId
} from '@src/common/setting-ids'
import type { DisabledSettingCollection } from '@src/common/settings-read'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { updateDynamicRulesMock } from '@test/mocks/web-extension'

const ruleCountForSetting = (settingId: SettingId): number => {
  let n = 0
  if (isContentSetting(settingId)) {
    n += 2
  }
  if (isNetworkSetting(settingId)) {
    n += NETWORK_PROTECTION_DEFS[settingId].length
  }
  if (isBlockerSetting(settingId)) {
    n += 1
  }
  return n
}

const totalRuleCountAllSettings = (): number =>
  ALL_SETTING_IDS.reduce((sum, id) => sum + ruleCountForSetting(id), 0)

beforeEach(() => {
  jest.clearAllMocks()
})

const getSingleUpdateCall = (): chrome.declarativeNetRequest.UpdateRuleOptions => {
  expect(updateDynamicRulesMock).toHaveBeenCalledTimes(1)
  const call = updateDynamicRulesMock.mock.calls[0]?.[0]
  expect(call).toBeDefined()
  expect(call).toHaveProperty('removeRuleIds')
  expect(call).toHaveProperty('addRules')
  if (call == null) {
    throw new Error('expected updateDynamicRules payload')
  }
  return call
}

describe('updateRulesForSetting', () => {
  const domain = 'example.com'

  it('calls updateDynamicRules once with batched content and network rules for gpc', async () => {
    await updateRulesForSetting('gpc', [domain])

    const call = getSingleUpdateCall()
    const expected = ruleCountForSetting('gpc')
    expect(call.removeRuleIds).toHaveLength(expected)
    expect(call.addRules).toHaveLength(expected)
    expect(call.removeRuleIds).toEqual(call.addRules?.map(r => r.id))

    const networkRules = call.addRules?.filter(r => r.priority === DNR_RULE_PRIORITIES.NETWORK) ?? []
    expect(networkRules).toHaveLength(1)
    expect(networkRules[0]?.condition.excludedTopDomains).toEqual([domain])
  })

  it('uses dummy-domain in rule conditions when disabled-domain list is empty', async () => {
    await updateRulesForSetting('gpc', [])

    const call = getSingleUpdateCall()
    const networkRules = call.addRules?.filter(r => r.priority === DNR_RULE_PRIORITIES.NETWORK) ?? []
    expect(networkRules[0]?.condition.excludedTopDomains).toEqual([RULE_DOMAIN_PLACEHOLDER])
  })

  it('calls updateDynamicRules once for masterSwitch with content and allow rules', async () => {
    await updateRulesForSetting('masterSwitch', [domain])

    const call = getSingleUpdateCall()
    expectRuleBatch(call, ruleCountForSetting('masterSwitch'))

    const allowRules = call.addRules?.filter(r => r.action.type === 'allow') ?? []
    expect(allowRules).toHaveLength(1)
    expect(allowRules[0]?.condition.topDomains).toEqual([domain])
  })

  it('calls updateDynamicRules once for math with only content rules', async () => {
    await updateRulesForSetting('math', [domain])

    const call = getSingleUpdateCall()
    expectRuleBatch(call, ruleCountForSetting('math'))
    expect(call.addRules?.every(r => r.priority === DNR_RULE_PRIORITIES.CONTENT_SCRIPTS)).toBe(true)
  })

  it('calls updateDynamicRules once for ads with only allow rule', async () => {
    await updateRulesForSetting('ads', [domain])

    const call = getSingleUpdateCall()
    expectRuleBatch(call, ruleCountForSetting('ads'))
    expect(call.addRules?.every(r => r.action.type === 'allow')).toBe(true)
  })

  it('calls updateDynamicRules once for queryParameters with one network rule per param pattern', async () => {
    const n = NETWORK_PROTECTION_DEFS.queryParameters.length
    await updateRulesForSetting('queryParameters', [domain])

    const call = getSingleUpdateCall()
    expectRuleBatch(call, ruleCountForSetting('queryParameters'))
    const networkRules = call.addRules?.filter(r => r.priority === DNR_RULE_PRIORITIES.NETWORK) ?? []
    expect(networkRules).toHaveLength(n)
  })
})

function expectRuleBatch (
  call: chrome.declarativeNetRequest.UpdateRuleOptions,
  expectedCount: number
): void {
  expect(call.removeRuleIds).toHaveLength(expectedCount)
  expect(call.addRules).toHaveLength(expectedCount)
  expect(call.removeRuleIds).toEqual(call.addRules?.map(r => r.id))
}

describe('updateRulesForAllSettings', () => {
  it('calls updateDynamicRules once with rules for every setting id', async () => {
    const total = totalRuleCountAllSettings()
    const collection: DisabledSettingCollection = {}

    await updateRulesForAllSettings(collection)

    const call = getSingleUpdateCall()
    expectRuleBatch(call, total)
  })

  it('passes stored domain lists into compiled rules', async () => {
    const collection: DisabledSettingCollection = {
      gpc: ['example.com'],
      ads: ['shop.example']
    }

    await updateRulesForAllSettings(collection)

    const call = getSingleUpdateCall()
    const gpcNetwork = call.addRules?.find(
      r =>
        r.priority === DNR_RULE_PRIORITIES.NETWORK &&
        r.condition.excludedTopDomains?.includes('example.com')
    )
    expect(gpcNetwork).toBeDefined()

    const adsAllow = call.addRules?.find(
      r => r.action.type === 'allow' && r.condition.topDomains?.includes('shop.example')
    )
    expect(adsAllow).toBeDefined()
  })
})
