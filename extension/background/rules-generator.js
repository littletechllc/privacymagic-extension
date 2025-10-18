import { generateRequestHeaders } from './headers.js'

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