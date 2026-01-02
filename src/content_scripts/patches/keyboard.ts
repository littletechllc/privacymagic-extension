/* global self */

import { redefinePropertyValues } from '../helpers.js';

const keyboard = () => {
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  return redefinePropertyValues(navigatorPrototype.prototype, {
    keyboard: undefined
  });
};

export default keyboard;
