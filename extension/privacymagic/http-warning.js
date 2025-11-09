/* global chrome */

const url = URL.parse(window.location.href).searchParams.get('url');
const domain = URL.parse(url).hostname;
document.getElementById('domain').textContent = domain;
document.getElementById('addException').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({
      type: 'addHttpWarningNetworkRuleException',
      url,
      value: 'exception'
    });
    window.location.replace(url);
  } catch (error) {
    console.error('error adding exception to http warning network rule', error);
  }
});

document.getElementById('goBack').addEventListener('click', () => {
  window.history.back();
});
