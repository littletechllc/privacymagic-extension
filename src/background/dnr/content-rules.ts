// Content rules are used to disable settings for specific top domains.
// Disabled settings are stored in a cookie set in the response headers
// of the web page and any subframes. Each content setting has a
// separate rule for enabled and disabled states.

import { isContentSetting, ContentSettingId, SettingId } from '@src/common/setting-ids'
import { CategoryId, DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'
import type { NonEmptyDomainList } from '@src/background/dnr/rule-domains'

const CONTENT_RULE_CATEGORY: CategoryId = 'content_rule'

const createContentRule = (settingId: ContentSettingId, domainsWhereSettingIsDisabled: NonEmptyDomainList, enabled: boolean): chrome.declarativeNetRequest.Rule => {
  const cookieKeyVal = `__pm_setting__${settingId}=${enabled ? '1' : '0'}`
  const headerValue = `${cookieKeyVal}; Secure; SameSite=None; Path=/; Partitioned`
  return {
    id: dnrRuleIdForName(CONTENT_RULE_CATEGORY, settingId, enabled ? 1 : 0),
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'append',
        header: 'Set-Cookie',
        value: headerValue
      }]
    },
    priority: DNR_RULE_PRIORITIES.CONTENT_SCRIPTS,
    condition: {
      resourceTypes: ["main_frame", "sub_frame"],
      ...(enabled
        ? { excludedTopDomains: [...domainsWhereSettingIsDisabled] }
        : { topDomains: [...domainsWhereSettingIsDisabled] })
    }
  }
}

export const computeContentRules = (settingId: SettingId, domainsWhereSettingIsDisabled: NonEmptyDomainList): chrome.declarativeNetRequest.Rule[] => {
  if (!isContentSetting(settingId)) {
    return []
  }
  return [
    createContentRule(settingId, domainsWhereSettingIsDisabled, true),
    createContentRule(settingId, domainsWhereSettingIsDisabled, false)
  ]
}
