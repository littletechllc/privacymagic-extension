/* global self */

import { redefinePropertyValues } from '../helpers.js';

const touch = () => {
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  const restoreNavigator = redefinePropertyValues(navigatorPrototype.prototype, {
    // Cover Your Tracks: 1 in 1.74:
    maxTouchPoints: 0
  });
  return () => {
    restoreNavigator();
  };
};

export default touch;
