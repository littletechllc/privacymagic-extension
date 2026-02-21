import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

const serviceWorker = (): void => {
  if (self.ServiceWorkerContainer === undefined) {
    return
  }

  const DOMExceptionSafe = self.DOMException
  redefinePropertyValues(self.ServiceWorkerContainer.prototype, {
    // eslint-disable-next-line @typescript-eslint/require-await
    register: async (/* ignore */) => {
      throw new DOMExceptionSafe('Service workers blocked', 'SecurityError')
    }
  })
}

export default serviceWorker
