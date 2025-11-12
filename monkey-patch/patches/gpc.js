/* global Navigator */

import { redefinePropertyValues } from '../helpers.js';

const gpc = () => {
  console.log('gpc patch', window.location.href);
  return redefinePropertyValues(Navigator.prototype, {
    globalPrivacyControl: true
  });
};

export default gpc;
