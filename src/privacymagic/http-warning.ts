import { logError } from '../common/util';

const url = URL.parse(window.location.href).searchParams.get('url');
const domain = URL.parse(url).hostname;
document.getElementById('domain').textContent = domain;
document.getElementById('addException').addEventListener('click', async (event) => {
  try {
    await chrome.runtime.sendMessage({
      type: 'addHttpWarningNetworkRuleException',
      url,
      value: 'exception'
    });
    window.location.replace(url);
  } catch (error) {
    logError(error, 'error adding exception to http warning network rule', { url, event });
  }
});

document.getElementById('goBack').addEventListener('click', () => {
  window.history.back();
});
