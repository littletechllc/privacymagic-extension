import './service-worker-utils.js'
import { contentBlockingDefinitions } from './content-blocking-definitions.js'
import { generateIcon } from './icon-generator.js'
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

const CHROME_PRIVACY_PREF_SETTINGS = {
  "adMeasurementEnabled": false,
  "doNotTrackEnabled": true,
  "fledgeEnabled": false,
  "hyperlinkAuditingEnabled": false,
  "protectedContentEnabled": false,
  "referrersEnabled": false,
  "relatedWebsiteSetsEnabled": false,
  "thirdPartyCookiesAllowed": false,
  "topicsEnabled": false,
}


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



const setPrivacySettings = async () => Promise.allSettled(
  Object.entries(CHROME_PRIVACY_PREF_SETTINGS).map(async ([key, value]) => {
    if (chrome.privacy.websites[key] !== undefined) {
      await chrome.privacy.websites[key].set({value});
    }
  })
)



const rules = {
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
};



generateIcon()

chrome.runtime.onInstalled.addListener(async function (details) {
  chrome.runtime.openOptionsPage()
  await chrome.declarativeNetRequest.updateDynamicRules(rules);
  await chrome.scripting.registerContentScripts(contentBlockingDefinitions)
  const scripts = await chrome.scripting.getRegisteredContentScripts()
  console.log("registered content scripts count: ", scripts.length)

});

const t1 = performance.now();
setPrivacySettings().then(() => {
  console.log("done", performance.now() - t1);
});

chrome.runtime.onStartup.addListener( () => {
  console.log(`onStartup()`);

});

chrome.runtime.openOptionsPage()