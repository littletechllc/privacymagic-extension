/* global Navigator */

import { redefinePropertyValues } from '../helpers.js';

const gpc = () => {
  console.log('gpc patch', self.location.href);
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  return redefinePropertyValues(navigatorPrototype.prototype, {
    globalPrivacyControl: true
  });
};

export default gpc;
