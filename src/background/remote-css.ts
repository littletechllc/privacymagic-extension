/* global chrome */

import { IDS } from './ids.js';

const setupRemoteCssRules = async () => {
  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [IDS.REMOTE_CSS_BLOCK_RULE_ID],
    addRules: [
      {
        id: IDS.REMOTE_CSS_BLOCK_RULE_ID,
        priority: 10,
        action: {
          type: 'block'
        },
        condition: {
          resourceTypes: ['stylesheet']
        }
      }
    ]
  });
};

const watchForCssRequests = async () => {
  const listener = (details) => {
    console.log('css request:', details);
    return {};
  };
  chrome.webRequest.onBeforeRequest.addListener(listener, { urls: ['<all_urls>'], types: ['stylesheet'] });
};

const handleRemoteCssRequests = async () => {
  await watchForCssRequests();
  await setupRemoteCssRules();
};

export { handleRemoteCssRequests };
