/* global self */

import { redefinePropertyValues, reflectApplySafe } from '../helpers.js';

const language = () => {
  const originalLanguage = 'en-US';
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  return redefinePropertyValues(navigatorPrototype.prototype, {
    // Reduce to a single language to reduce entropy.
    languages: [originalLanguage]
  });
};

export default language;
