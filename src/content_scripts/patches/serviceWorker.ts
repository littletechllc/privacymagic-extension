import { redefineMethods } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const serviceWorker = (globalObject: GlobalScope): void => {
  if (globalObject.ServiceWorkerContainer === undefined) {
    return
  }

  const DOMExceptionSafe = globalObject.DOMException
  redefineMethods(globalObject.ServiceWorkerContainer.prototype, {
    // eslint-disable-next-line @typescript-eslint/require-await
    register: async (/* ignore */) => {
      throw new DOMExceptionSafe('Service workers blocked', 'SecurityError')
    }
  })

  const container = globalObject.navigator.serviceWorker
  if (container == null || typeof container.getRegistrations !== 'function') {
    return
  }
  // Safari has no browsingData.removeServiceWorkers, so drop workers already
  // registered for the site being visited.
  void container.getRegistrations().then(async (registrations) => {
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }).catch((error: unknown) => {
    // No service-worker provider (about:blank, opaque sandbox, detached frame).
    // That document has no registrations.
    if (error instanceof DOMExceptionSafe && error.name === 'InvalidStateError') {
      return
    }
    globalObject.console.error('error unregistering service workers', error)
  })
}

export default serviceWorker
