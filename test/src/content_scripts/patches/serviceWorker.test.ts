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

    it('should throw SecurityError when register is called', () => {
      expect(() => navigator.serviceWorker.register('/sw.js')).toThrow(DOMException)
      try {
        void navigator.serviceWorker.register('/sw.js')
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException)
        expect((e as DOMException).name).toBe('SecurityError')
        expect((e as DOMException).message).toBe('Service workers blocked')
      }
    })
  })
})
