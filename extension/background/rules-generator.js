const QUERY_PARAMS_TO_REMOVE = [
  "__hsfp",
  "__hssc",
  "__hstc",
  "__s",
  "_hsenc",
  "_openstat",
  "dclid",
  "fbclid",
  "gclid",
  "hsCtaTracking",
  "mc_eid",
  "mkt_tok",
  "ml_subscriber",
  "ml_subscriber_hash",
  "msclkid",
  "oly_anon_id",
  "oly_enc_id",
  "rb_clickid",
  "s_cid",
  "vero_conv",
  "vero_id",
  "wickedid",
  "yclid",
]   

const HEADERS_TO_REMOVE = [
  "Device-Memory",
  "Downlink",
  "DPR",
  "ECT",
  "RTT",
  "Sec-CH-Device-Memory",
  "Sec-CH-DPR",
  "Sec-CH-ECT",
  "Sec-CH-Prefers-Color-Scheme",
  "Sec-CH-Prefers-Reduced-Motion",
  "Sec-CH-Prefers-Reduced-Transparency",
  "Sec-CH-UA-Form-Factors",
  "Sec-CH-Viewport-Height",
  "Sec-CH-Viewport-Width",
  "Viewport-Width",
]

const HEADERS_TO_SET = {
  "Sec-CH-UA-Arch": "arm",
  "Sec-CH-UA-Bitness": "64",
  "Sec-CH-UA-Form-Factors-List": "Desktop",
  "Sec-CH-UA-Form-Factors": "Desktop",
  "Sec-CH-UA-Full-Version-List": "Google Chrome;v=\"141.0.0.0\", Not?A_Brand;v=\"8.0.0.0\", Chromium;v=\"141.0.0.0\"",
  "Sec-CH-UA-Full-Version": "141.0.0.0",
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Model": "",
  "Sec-CH-UA-Platform-Version": "13.0.0",
  "Sec-CH-UA-Platform": "Windows",
  "Sec-CH-UA": "Google Chrome;v=\"141\", Not?A_Brand;v=\"8\", Chromium;v=\"141\"",
  "Sec-GPC": "1",
}

export const generateRequestHeaders = () => [
  ...HEADERS_TO_REMOVE.map((header) => ({ header, operation: "remove"})),
  ...Object.entries(HEADERS_TO_SET).map(([header, value]) => ({operation: "set", header, value}))
]
 
const ALL_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other"
]

export const generateRules = () => {
  return {
    removeRuleIds: [1, 2],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: generateRequestHeaders()
        },
        condition: {
          urlFilter: "*",
          "resourceTypes": ALL_RESOURCE_TYPES
        },
      },
      {
        id: 2,
        priority: 1,
        action: {
          type: "redirect",
          "redirect": {
            "transform": { "queryTransform": {"removeParams": QUERY_PARAMS_TO_REMOVE }}
          }
        },
        condition: {
          urlFilter: "*",
          "resourceTypes": ALL_RESOURCE_TYPES
        },
      },
    ],
  }
}

export const initializeDynamicRules = async () => {
  await chrome.declarativeNetRequest.updateDynamicRules(generateRules())
}

export const clearDynamicRules = async () => {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2]
  })
}