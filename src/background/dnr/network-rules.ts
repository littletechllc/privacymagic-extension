// Network rules are used to apply fingerprinting protections
// to network requests. They are applied to all network requests,
// except web pages under excluded top domains.

import { NetworkSettingId, SettingId } from '@src/common/setting-ids'
import { ALL_RESOURCE_TYPES } from '@src/common/util'
import { objectEntries } from '@src/common/data-structures'
import { includeInListIfNeeded } from '@src/common/data-structures'
import { CategoryId, DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

const setHeaders = (headers: Record<string, string>): chrome.declarativeNetRequest.ModifyHeaderInfo[] =>
  Object.entries(headers).map(
    ([header, value]: [string, string]) => ({ operation: 'set', header, value }))

const removeHeaders = (list: string[]): chrome.declarativeNetRequest.ModifyHeaderInfo[] =>
  list.map(header => ({ operation: 'remove', header }))

type PartialRule = {
  condition?: chrome.declarativeNetRequest.RuleCondition,
  action: chrome.declarativeNetRequest.RuleAction
}

export const NETWORK_PROTECTION_DEFS:
  Record<NetworkSettingId, PartialRule[]> = {
  gpc: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { operation: 'set', header: 'Sec-GPC', value: '1' }
      ]
    },
  }],
  useragent: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: setHeaders({
        'Sec-CH-UA-Full-Version-List': 'Google Chrome;v="141.0.0.0", Not?A_Brand;v="8.0.0.0", Chromium;v="141.0.0.0"',
        'Sec-CH-UA-Full-Version': '141.0.0.0'
      })
    },
  }],
  queryParameters: [{
    action: {
      type: 'redirect',
      redirect: {
        transform: {
          queryTransform: {
            removeParams: [
              '__hsfp',
              '__hssc',
              '__hstc',
              '__s',
              '_hsenc',
              '_openstat',
              'dclid',
              'fbclid',
              'gclid',
              'hsCtaTracking',
              'mc_eid',
              'mkt_tok',
              'ml_subscriber',
              'ml_subscriber_hash',
              'msclkid',
              'oly_anon_id',
              'oly_enc_id',
              'rb_clickid',
              's_cid',
              'vero_conv',
              'vero_id',
              'wickedid',
              'yclid'
            ]
          }
        }
      }
    },
  }],
  network: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Downlink',
        'ECT',
        'RTT',
        'Save-Data',
        'Sec-CH-ECT'
      ])
    },
  }],
  screen: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'DPR',
        'Sec-CH-Viewport-Height',
        'Sec-CH-Viewport-Width',
        'Sec-CH-DPR',
        'Viewport-Width'
      ])
    },
  }],
  display: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Sec-CH-Prefers-Color-Scheme',
        'Sec-CH-Prefers-Reduced-Motion',
        'Sec-CH-Prefers-Reduced-Transparency'
      ])
    },
  }],
  language: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: setHeaders({
        'Accept-Language': navigator.language
      })
    },
  }],
  memory: [{
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Device-Memory',
        'Sec-CH-Device-Memory'
      ])
    },
  }],
  css: [{
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'append',
        header: 'Content-Security-Policy',
        // value: "style-src-elem 'none';"
        value: 'style-src-elem https:;'
        // value: "style-src-elem 'unsafe-inline';"
      }]
    },
  }, {
    action: {
      type: 'block'
    },
    condition: {
      resourceTypes: ['stylesheet']
    }
  }],
  referrerPolicy: [{
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'set',
        header: 'referrer-policy',
        value: 'strict-origin-when-cross-origin'
      }]
    },
    condition: {
      excludedResponseHeaders: [{
        header: 'referrer-policy',
        values: ['no-referrer', 'origin', 'same-origin', 'strict-origin']
      }]
    }
  }, {
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'set',
        header: 'referrer-policy',
        value: 'strict-origin'
      }]
    },
    condition: {
      responseHeaders: [{
        header: 'referrer-policy',
        values: ['origin']
      }]
    }
  }]
}

const category: CategoryId = 'network_rule'

const prepareNetworkRules = (): Record<NetworkSettingId, chrome.declarativeNetRequest.Rule[]> => {
  const resultRules = {} as Record<NetworkSettingId, chrome.declarativeNetRequest.Rule[]>
  for (const [settingId, rules] of objectEntries(NETWORK_PROTECTION_DEFS)) {
    let i: number = 0;
    for (const rule of rules) {
      const resultRule: chrome.declarativeNetRequest.Rule = {
        ...rule,
        id: dnrRuleIdForName(category, `${settingId}${rules.length > 1 ? String(i) : ''}`),
        priority: DNR_RULE_PRIORITIES.NETWORK,
        condition: {
          resourceTypes: ALL_RESOURCE_TYPES,
          ...rule.condition
        }
      }
      if (!resultRules[settingId]) {
        resultRules[settingId] = []
      }
      resultRules[settingId].push(resultRule)
      ++i
    }
  }
  return resultRules
}

const baseRules = prepareNetworkRules()

const isNetworkSetting = (setting: SettingId): setting is NetworkSettingId => {
  return setting in NETWORK_PROTECTION_DEFS
}

export const computeNetworkRuleUpdates = async (topDomain: string, setting: SettingId, protectionEnabled: boolean): Promise<chrome.declarativeNetRequest.UpdateRuleOptions | undefined> => {
  if (!isNetworkSetting(setting)) {
    return undefined
  }
  const ruleIds = baseRules[setting].map(rule => rule.id)
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules({ruleIds})
  const rules = structuredClone(oldRules.length > 0 ? oldRules : baseRules[setting])
  for (const rule of rules) {
    rule.condition.excludedTopDomains = includeInListIfNeeded<string>(rule.condition.excludedTopDomains, topDomain, !protectionEnabled)
  }
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules
  }
  return updateRuleOptions
}

export const computeDefaultNetworkRuleUpdates = (): (chrome.declarativeNetRequest.UpdateRuleOptions | undefined)[] => {
  const updateRuleOptionsList : (chrome.declarativeNetRequest.UpdateRuleOptions | undefined)[] = [];
  for (const rules of Object.values(baseRules)) {
    for (const rule of rules) {
      updateRuleOptionsList.push({
        addRules: [rule], removeRuleIds: [rule.id]
      })
    }
  }
  return updateRuleOptionsList
}