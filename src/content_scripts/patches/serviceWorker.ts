import { redefinePropertyValues } from '../helpers'

const serviceWorker = (): void => {
  if (self.ServiceWorkerContainer === undefined) {
    return
  }

  const DOMExceptionSafe = self.DOMException
  redefinePropertyValues(self.ServiceWorkerContainer.prototype, {
    register: (/* ignore */) => {
      throw new DOMExceptionSafe('Service workers blocked', 'SecurityError')
    }
  })
}

export default serviceWorker
