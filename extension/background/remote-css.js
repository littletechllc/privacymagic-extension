/* global chrome */

const setupRemoteCssRules = async () => {
  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [600],
    addRules: [
      {
        id: 600,
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

const watchForFetchRequests = async () => {
  const listener = async (details) => {
    console.log('fetch request:', details);
  };
  chrome.webRequest.onBeforeRequest.addListener(listener, { urls: ['<all_urls>'] });
};

const watchForCssRequests = async () => {
  const listener = async (details) => {
    console.log('css request:', details);
  };
  chrome.webRequest.onBeforeRequest.addListener(listener, { urls: ['<all_urls>'], types: ['stylesheet'] });
};

const handleRemoteCssRequests = async () => {
  await watchForCssRequests();
  await setupRemoteCssRules();
};

export { handleRemoteCssRequests };
