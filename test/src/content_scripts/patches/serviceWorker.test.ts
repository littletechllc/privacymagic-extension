import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import serviceWorker from '@src/content_scripts/patches/serviceWorker'

class MockServiceWorkerContainer {
  register(_scriptURL: string): Promise<ServiceWorkerRegistration> {
    return Promise.resolve({} as ServiceWorkerRegistration)
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
      serviceWorker()
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
