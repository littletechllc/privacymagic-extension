import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals'
import serviceWorker from '@src/content_scripts/patches/serviceWorker'

class MockServiceWorkerContainer {
  registrations: ServiceWorkerRegistration[] = []
  register(_scriptURL: string): Promise<ServiceWorkerRegistration> {
    return Promise.resolve({} as ServiceWorkerRegistration)
  }
  getRegistrations(): Promise<ServiceWorkerRegistration[]> {
    return Promise.resolve(this.registrations)
  }
  getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    return Promise.resolve(undefined)
  }
  startMessages(): void {}
}

type SelfWithSW = { ServiceWorkerContainer?: typeof MockServiceWorkerContainer }
type NavWithSW = { serviceWorker?: MockServiceWorkerContainer }

describe('serviceWorker patch', () => {
  let originalServiceWorkerContainer: typeof MockServiceWorkerContainer | undefined
  let originalNavigatorServiceWorker: MockServiceWorkerContainer | undefined

  beforeEach(() => {
    const selfWithSW = self as unknown as SelfWithSW
    const navWithSW = navigator as unknown as NavWithSW
    originalServiceWorkerContainer = selfWithSW.ServiceWorkerContainer
    originalNavigatorServiceWorker = navWithSW.serviceWorker
    selfWithSW.ServiceWorkerContainer = MockServiceWorkerContainer
    Object.defineProperty(navigator, 'serviceWorker', {
      value: new MockServiceWorkerContainer(),
      configurable: true,
      enumerable: true
    })
  })

  afterEach(() => {
    const selfWithSW = self as unknown as SelfWithSW
    const navWithSW = navigator as unknown as NavWithSW
    if (originalServiceWorkerContainer !== undefined) {
      selfWithSW.ServiceWorkerContainer = originalServiceWorkerContainer
    } else {
      delete selfWithSW.ServiceWorkerContainer
    }
    if (originalNavigatorServiceWorker !== undefined) {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: originalNavigatorServiceWorker,
        configurable: true,
        enumerable: true
      })
    } else {
      delete navWithSW.serviceWorker
    }
  })

  describe('without patch', () => {
    it('should allow register to resolve', async () => {
      const reg = await navigator.serviceWorker.register('/sw.js')
      expect(reg).toBeDefined()
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      serviceWorker(self)
    })

    it('unregisters service workers already registered for this site', async () => {
      let unregistered = false
      const container = new MockServiceWorkerContainer()
      container.registrations = [{
        unregister: () => {
          unregistered = true
          return Promise.resolve(true)
        }
      } as ServiceWorkerRegistration]
      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        enumerable: true
      })
      serviceWorker(self)
      await Promise.resolve()
      expect(unregistered).toBe(true)
    })

    it('ignores InvalidStateError when the document cannot have service workers', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const container = new MockServiceWorkerContainer()
      container.getRegistrations = () => Promise.reject(new DOMException('The document is in an invalid state.', 'InvalidStateError'))
      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        enumerable: true
      })
      serviceWorker(self)
      // getRegistrations() is already rejected. One turn lets that rejection
      // pass through .then(); the next turn runs .catch().
      await Promise.resolve()
      await Promise.resolve()
      expect(errorSpy).not.toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('logs other errors while unregistering service workers', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const failure = new DOMException('The operation is insecure.', 'SecurityError')
      const container = new MockServiceWorkerContainer()
      container.getRegistrations = () => Promise.reject(failure)
      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        enumerable: true
      })
      serviceWorker(self)
      // getRegistrations() is already rejected. One turn lets that rejection
      // pass through .then(); the next turn runs .catch().
      await Promise.resolve()
      await Promise.resolve()
      expect(errorSpy).toHaveBeenCalledWith('error unregistering service workers', failure)
      errorSpy.mockRestore()
    })

    it('should reject with SecurityError when register is called', async () => {
      await expect(navigator.serviceWorker.register('/sw.js')).rejects.toMatchObject({
        name: 'SecurityError',
        message: 'Service workers blocked'
      })
      const err = await navigator.serviceWorker.register('/sw.js').then(
        () => null,
        (e: unknown) => e
      )
      expect(err).toBeInstanceOf(DOMException)
    })
  })
})
