/* global StorageManager */

import { redefinePropertyValues } from '../helpers.js';

const disk = () => {
  return redefinePropertyValues(StorageManager.prototype, {
    estimate: () => Promise.resolve({
      // Never report any usage
      usage: 0,
      // Report a fixed quota of 2 GB
      quota: 2147483648,
      // Never report any usage details
      usageDetails: {}
    })
  });
};

export default disk;
