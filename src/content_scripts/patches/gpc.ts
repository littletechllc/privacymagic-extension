import { redefinePropertyValues } from '../helpers';

// Global Privacy Control is a signal that allows users to opt out of websites
// selling or sharing their personal information with third parties.
// https://globalprivacycontrol.org/
const gpc = () => {
  console.log('gpc patch', self.location.href);
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  return redefinePropertyValues(navigatorPrototype.prototype, {
    globalPrivacyControl: true
  });
};

export default gpc;
