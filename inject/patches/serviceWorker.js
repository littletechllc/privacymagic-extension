/* global self */

import { redefinePropertyValues } from '../helpers.js';

const serviceWorker = () => {
  if (!self.ServiceWorkerContainer) {
    return () => {};
  }

  const DOMExceptionSafe = self.DOMException;
  return redefinePropertyValues(self.ServiceWorkerContainer.prototype, {
    register: (/* ignore */) => {
      throw new DOMExceptionSafe('Service workers blocked', 'SecurityError');
    }
  });
};

export default serviceWorker;
