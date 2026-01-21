// Network rules are used to apply fingerprinting protections
// to network requests. They are applied to all network requests,
// except web pages under excluded top domains.

import { SettingId } from '@src/common/setting-ids'
import { ALL_RESOURCE_TYPES, updateListOfExceptions } from '@src/common/util'
import { DNR_RULE_PRIORITIES, dnrRuleIdForName } from '@src/background/dnr/rule-parameters'

const setHeaders = (headers: Record<string, string>): chrome.declarativeNetRequest.ModifyHeaderInfo[] =>
  Object.entries(headers).map(
    ([header, value]: [string, string]) => ({ operation: 'set' as const, header, value }))

const removeHeaders = (list: string[]): chrome.declarativeNetRequest.ModifyHeaderInfo[] =>
  list.map(header => ({ operation: 'remove', header }))

type PartialRule = {
  condition?: chrome.declarativeNetRequest.RuleCondition,
  action: chrome.declarativeNetRequest.RuleAction
}

const NETWORK_PROTECTION_DEFS:
  Partial<Record<SettingId, PartialRule[]>> = {
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

const category = 'network_rule'

const prepareNetworkRules = (): Record<string, chrome.declarativeNetRequest.Rule[]> => {
  const resultRules: Record<string, chrome.declarativeNetRequest.Rule[]> = {}
  for (const [settingId, rules] of Object.entries(NETWORK_PROTECTION_DEFS)) {
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

export const updateNetworkRules = async (topDomain: string, setting: SettingId, value: boolean): Promise<void> => {
  if (!(setting in NETWORK_PROTECTION_DEFS)) {
    return
  }
  const ruleIds = baseRules[setting].map(rule => rule.id)
  const oldRules = await chrome.declarativeNetRequest.getSessionRules({ruleIds})
  const rules = structuredClone(oldRules.length > 0 ? oldRules : baseRules[setting])
  for (const rule of rules) {
    rule.condition.excludedTopDomains = updateListOfExceptions<string>(rule.condition.excludedTopDomains, topDomain, value)
  }
  const updateRuleOptions: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: rules.map(rule => rule.id),
    addRules: rules
  }
  await chrome.declarativeNetRequest.updateSessionRules(updateRuleOptions)
}
