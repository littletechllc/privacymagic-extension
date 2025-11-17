/* global chrome */

import { getSharedSecret } from './secret.js';

console.log('isolated.js loaded with secret:', getSharedSecret());

const sendGetDisabledSettingsResponse = async () => {
  try {
    console.log('waiting for getDisabledSettings response');
    const result = await chrome.runtime.sendMessage(
      { type: 'getDisabledSettings' });
    console.log('result:', result);
    const disabledSettings = result.disabledSettings;
    console.log('getDisabledSettings response received', disabledSettings);
    // Use a null-prototype object for the detail to avoid monkey patching.
    const detail = Object.create(null);
    detail.type = 'getDisabledSettingsResponse';
    detail.disabledSettings = disabledSettings;
    document.documentElement.dispatchEvent(new CustomEvent(`message-${getSharedSecret()}`, { detail }));
  } catch (error) {
    console.error('error sending getDisabledSettings response', error);
  }
};

sendGetDisabledSettingsResponse();
