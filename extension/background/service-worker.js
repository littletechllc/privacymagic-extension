import './service-worker-utils.js'
import { contentBlockingDefinitions } from './content-blocking-definitions.js'

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

const setPrivacySettings = async () => Promise.allSettled(
  Object.entries(CHROME_PRIVACY_PREF_SETTINGS).map(async ([key, value]) => {
    if (chrome.privacy.websites[key] !== undefined) {
      await chrome.privacy.websites[key].set({value});
    }
  })
)


const requestHeaders = [
  ...HEADERS_TO_REMOVE.map((header) => ({ header, operation: "remove"})),
  ...Object.entries(HEADERS_TO_SET).map(([header, value]) => ({operation: "set", header, value}))
]

const rules = {
  removeRuleIds: [1, 2],
  addRules: [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders
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

const makePNG = async () => {
  const canvas = new OffscreenCanvas(128, 128)
  const ctx = canvas.getContext('2d')

  try {

    const emoji = '🪬'
    // Draw emoji to fill canvas boundaries
    const canvasSize = 128

    // Set background color
    ctx.fillStyle = 'rgb(255, 255, 255)'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Calculate font size to fill the canvas
    let fontSize = canvasSize
    ctx.font = `${fontSize}px "Modern Antiqua", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'



    // Measure text and adjust font size if needed
    const metrics = ctx.measureText(emoji)
    console.log(metrics)
    const textWidth = metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft
    const textHeight = metrics.actualBoundingBoxDescent + metrics.actualBoundingBoxAscent
    console.log({textWidth, textHeight})
    fontSize = fontSize * canvasSize / textHeight
    ctx.font = `${fontSize}px "Modern Antiqua", serif`

    // Draw the emoji
    ctx.fillStyle = '#ffffff'
    ctx.fillText(emoji, canvasSize / 2 , canvasSize / 2 - metrics.actualBoundingBoxDescent / 2 + metrics.actualBoundingBoxAscent / 2)

    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const base64 = btoa(String.fromCharCode.apply(null, uint8Array))
    const dataURL = `data:image/png;base64,${base64}`
    chrome.action.setIcon({path: dataURL})
  } catch (error) {
    console.error('Failed to create icon from canvas:', error)
    // Fallback: just use the existing PNG files
    chrome.action.setIcon({
      path: {
        "16": "logo/logo-16.png",
        "32": "logo/logo-32.png",
        "48": "logo/logo-48.png",
        "128": "logo/logo-128.png"
      }
    })
  }
}

makePNG()

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