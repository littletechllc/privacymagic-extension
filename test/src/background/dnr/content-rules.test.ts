import '@test/mocks/globals'
import '@test/mocks/web-extension'
import { computeContentRules } from '@src/background/dnr/content-rules'
import { RULE_DOMAIN_PLACEHOLDER } from '@src/background/dnr/rule-domains'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import type { ContentSettingId, SettingId } from '@src/common/setting-ids'
import { describe, it, expect } from '@jest/globals'

const category = 'content_rule' as const

const cookieHeaderValue = (settingId: ContentSettingId, enabled: boolean): string =>
  `__pm_setting__${settingId}=${enabled ? '1' : '0'}; Secure; SameSite=None; Path=/; Partitioned`

describe('computeContentRules', () => {
  const domain = 'example.com'
  const setting: ContentSettingId = 'cpu'

  describe('when setting is not a content setting', () => {
    it('should return empty array', () => {
      const result = computeContentRules('ads' as SettingId, [domain])
      expect(result).toEqual([])
    })
  })

  describe('when setting is a content setting', () => {
    it('should return enabled and disabled rules with placeholder when no real domains (manager normalization)', () => {
      const result = computeContentRules(setting, [RULE_DOMAIN_PLACEHOLDER])

      expect(result).toEqual([
        {
          id: dnrRuleIdForName(category, setting, 1),
          priority: DNR_RULE_PRIORITIES.CONTENT_SCRIPTS,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [{
              operation: 'append',
              header: 'Set-Cookie',
              value: cookieHeaderValue(setting, true)
            }]
          },
          condition: {
            resourceTypes: ['main_frame', 'sub_frame'],
            excludedTopDomains: [RULE_DOMAIN_PLACEHOLDER]
          }
        },
        {
          id: dnrRuleIdForName(category, setting, 0),
          priority: DNR_RULE_PRIORITIES.CONTENT_SCRIPTS,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [{
              operation: 'append',
              header: 'Set-Cookie',
              value: cookieHeaderValue(setting, false)
            }]
          },
          condition: {
            resourceTypes: ['main_frame', 'sub_frame'],
            topDomains: [RULE_DOMAIN_PLACEHOLDER]
          }
        }
      ])
    })

    it('should use excludedTopDomains for enabled rule and topDomains for disabled rule', () => {
      const result = computeContentRules(setting, [domain, 'other.com'])

      expect(result).toHaveLength(2)
      expect(result[0]?.condition).toMatchObject({
        excludedTopDomains: [domain, 'other.com']
      })
      expect(result[1]?.condition).toMatchObject({
        topDomains: [domain, 'other.com']
      })
    })

    it('should set per-rule cookie values', () => {
      const result = computeContentRules(setting, [domain])

      const enabledVal = result[0]?.action.type === 'modifyHeaders'
        ? result[0].action.responseHeaders?.find(h => h.header === 'Set-Cookie')?.value
        : undefined
      const disabledVal = result[1]?.action.type === 'modifyHeaders'
        ? result[1].action.responseHeaders?.find(h => h.header === 'Set-Cookie')?.value
        : undefined

      expect(enabledVal).toBe(cookieHeaderValue(setting, true))
      expect(disabledVal).toBe(cookieHeaderValue(setting, false))
    })
  })
})
