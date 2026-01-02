import { redefinePropertyValues } from '../helpers';

const memory = () => {
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  return redefinePropertyValues(navigatorPrototype.prototype, {
    // Cover Your Tracks: 1 in 1.93 browsers have this value:
    deviceMemory: undefined
  });
};

export default memory;
