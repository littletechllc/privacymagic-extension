import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const serviceWorker = (globalObject: GlobalScope): void => {
  if (globalObject.ServiceWorkerContainer === undefined) {
    return
  }

  const DOMExceptionSafe = globalObject.DOMException
  redefinePropertyValues(globalObject.ServiceWorkerContainer.prototype, {
    // eslint-disable-next-line @typescript-eslint/require-await
    register: async (/* ignore */) => {
      throw new DOMExceptionSafe('Service workers blocked', 'SecurityError')
    }
  })
}

export default serviceWorker
