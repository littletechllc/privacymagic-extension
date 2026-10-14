import { acceptLanguageHeader } from '@src/common/languages-array'
import { browserInfo } from '@src/common/browser'
import { NetworkSettingId } from '@src/common/setting-ids'
import { networkRuleId, queryParametersRuleId } from './rule-ids'

export const disallowedQueryParams = [
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

export type DisallowedQueryParam = typeof disallowedQueryParams[number]

const setHeaders = (headers: Record<string, string>): chrome.declarativeNetRequest.ModifyHeaderInfo[] =>
  Object.entries(headers).map(
    ([header, value]: [string, string]) => ({ operation: 'set', header, value }))

const removeHeaders = (list: string[]): chrome.declarativeNetRequest.ModifyHeaderInfo[] =>
  list.map(header => ({ operation: 'remove', header }))

export type NetworkPartialRule = {
  condition?: chrome.declarativeNetRequest.RuleCondition
  action: chrome.declarativeNetRequest.RuleAction
  id: number
}

/**
 * Chromium-only Client Hint / related header removals.
 * Safari and Firefox do not send these; Safari also rejects unrecognized Sec-CH-*
 * names and fails the whole updateDynamicRules batch.
 */
export const CLIENT_HINT_HIDING_NETWORK_DEFS = {
  useragent: [{
    id: networkRuleId('useragent'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Sec-CH-UA-Full-Version',
        'Sec-CH-UA-Full-Version-List'
      ])
    },
  }],
  network: [{
    id: networkRuleId('network'),
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
    id: networkRuleId('screen'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'DPR',
        'Sec-CH-DPR',
        'Sec-CH-Viewport-Height',
        'Sec-CH-Viewport-Width',
        'Sec-CH-Width',
        'Viewport-Width',
        'Width'
      ])
    },
  }],
  display: [{
    id: networkRuleId('display'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Sec-CH-Prefers-Color-Scheme',
        'Sec-CH-Prefers-Reduced-Motion',
        'Sec-CH-Prefers-Reduced-Transparency'
      ])
    },
  }],
  memory: [{
    id: networkRuleId('memory'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Device-Memory',
        'Sec-CH-Device-Memory'
      ])
    },
  }],
  cpu: [{
    id: networkRuleId('cpu'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Sec-CH-UA-Architecture',
        'Sec-CH-UA-Bitness'
      ])
    },
  }],
  device: [{
    id: networkRuleId('device'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: removeHeaders([
        'Sec-CH-UA-Form-Factors',
        'Sec-CH-UA-Mobile',
        'Sec-CH-UA-Model',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-WoW64'
      ])
    },
  }]
} satisfies Partial<Record<NetworkSettingId, NetworkPartialRule[]>>

export const NETWORK_PROTECTION_DEFS: Record<NetworkSettingId, NetworkPartialRule[]> = {
  gpc: [{
    id: networkRuleId('gpc'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { operation: 'set', header: 'Sec-GPC', value: '1' }
      ]
    },
  }],
  // Only match URLs that actually have at least one removable param. Otherwise the redirect
  // rule would match clean URLs too (priority 4) and always win over the allow rule (3),
  // so "ads off" per-site would never unblock requests that were already redirected.
  queryParameters: disallowedQueryParams.map(param => ({
    id: queryParametersRuleId(param),
    action: {
      type: 'redirect',
      redirect: {
        transform: {
          queryTransform: {
            removeParams: disallowedQueryParams
          }
        }
      }
    },
    condition: {
      regexFilter: `[\\?&]${param}=`
    }
  })),
  language: [{
    id: networkRuleId('language'),
    action: {
      type: 'modifyHeaders',
      requestHeaders: setHeaders({
        'Accept-Language': acceptLanguageHeader(
          navigator.languages.length > 0 ? navigator.languages : [navigator.language]
        )
      })
    },
  }],
  /* css: [{
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
  }], */
  referrerPolicy: [{
    id: networkRuleId('referrerPolicyStrictOriginWhenCrossOrigin'),
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
    id: networkRuleId('referrerPolicyStrictOrigin'),
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
  }],
  // Prevent cache leaks from stylesheets, scripts, images, fonts, and media
  // observed in Chromium-based browsers.
  cache: [{
    id: networkRuleId('cache'),
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{
        operation: 'set',
        header: 'Cache-Control',
        value: 'no-store'
      }]
    },
    condition: {
      resourceTypes: ['stylesheet', 'script', 'image', 'font', 'media', 'other']
    }
  }],
  ...(browserInfo.isChromium
    ? CLIENT_HINT_HIDING_NETWORK_DEFS
    : {
        useragent: [],
        network: [],
        screen: [],
        display: [],
        memory: [],
        cpu: [],
        device: []
      })
}
