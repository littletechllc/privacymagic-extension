/* global self */

import { redefinePropertyValues } from '../helpers.js';

const memory = () => {
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  return redefinePropertyValues(navigatorPrototype.prototype, {
    deviceMemory: undefined
  });
};

export default memory;
