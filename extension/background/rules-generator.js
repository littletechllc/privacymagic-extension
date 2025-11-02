/* global chrome */

const HEADERS_TO_REMOVE = [
  'Device-Memory',
  'Downlink',
  'DPR',
  'ECT',
  'RTT',
  'Sec-CH-Device-Memory',
  'Sec-CH-DPR',
  'Sec-CH-ECT',
  'Sec-CH-Prefers-Color-Scheme',
  'Sec-CH-Prefers-Reduced-Motion',
  'Sec-CH-Prefers-Reduced-Transparency',
  'Sec-CH-UA-Form-Factors',
  'Sec-CH-Viewport-Height',
  'Sec-CH-Viewport-Width',
  'Viewport-Width'
];

export const generateRequestHeaders = () => [
  ...HEADERS_TO_REMOVE.map((header) => ({ header, operation: 'remove' }))
];

const ALL_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'other'
];

export const generateRules = () => {
  return {
    removeRuleIds: [1, 2],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: generateRequestHeaders()
        },
        condition: {
          urlFilter: '*',
          resourceTypes: ALL_RESOURCE_TYPES
        }
      }
    ]
  };
};

export const initializeDynamicRules = async () => {
  await chrome.declarativeNetRequest.updateDynamicRules(generateRules());
};

export const clearDynamicRules = async () => {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2]
  });
};
