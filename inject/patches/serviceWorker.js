import { redefinePropertyValues } from '../helpers.js';

const serviceWorker = () => {
  if (!self.ServiceWorkerContainer) {
    return () => {};
  }

  const DOMExceptionSafe = self.DOMException;
  return redefinePropertyValues(ServiceWorkerContainer.prototype, {
    register: ( /* ignore */ ) => { 
      throw new DOMExceptionSafe('Service workers blocked', 'SecurityError');
    },
  });
};

export default serviceWorker;