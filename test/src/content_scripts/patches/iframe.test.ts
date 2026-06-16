import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'

const createSafeGetterMock = jest.fn()
const createSafeMethodMock = jest.fn()
const createSafeSetterMock = jest.fn()
const redefinePrototypeFieldsMock = jest.fn()
const redefineMethodsMock = jest.fn()
const weakSetHasSafeMock = jest.fn().mockReturnValue(true)
const weakSetAddSafeMock = jest.fn()
const applyPatchesToGlobalObjectMock = jest.fn()

jest.unstable_mockModule('@src/content_scripts/helpers/patch', () => ({
  applyPatchesToGlobalObject: applyPatchesToGlobalObjectMock
}))

jest.unstable_mockModule('@src/content_scripts/helpers/monkey-patch', () => ({
  createSafeGetter: createSafeGetterMock,
  createSafeMethod: createSafeMethodMock,
  createSafeSetter: createSafeSetterMock,
  objectDefinePropertiesSafe: Object.defineProperties,
  objectGetOwnPropertyDescriptorSafe: Object.getOwnPropertyDescriptor,
  redefineMethods: redefineMethodsMock,
  redefinePrototypeFields: redefinePrototypeFieldsMock
}))

jest.unstable_mockModule('@src/content_scripts/helpers/safe', () => ({
  weakSetHasSafe: weakSetHasSafeMock,
  weakSetAddSafe: weakSetAddSafeMock
}))

function installPrototypeGetters (
  ctor: { prototype: HTMLIFrameElement },
  fieldMap: {
    contentWindow?: (this: HTMLIFrameElement) => Window | null
    contentDocument?: (this: HTMLIFrameElement) => Document | null
  }
): void {
  const descriptors: PropertyDescriptorMap = {}
  if (fieldMap.contentWindow != null) {
    descriptors.contentWindow = { get: fieldMap.contentWindow, configurable: true }
  }
  if (fieldMap.contentDocument != null) {
    descriptors.contentDocument = { get: fieldMap.contentDocument, configurable: true }
  }
  Object.defineProperties(ctor.prototype, descriptors)
}

const installPrototypeGettersMock = (...args: unknown[]): void => {
  installPrototypeGetters(
    args[0] as { prototype: HTMLIFrameElement },
    args[1] as Parameters<typeof installPrototypeGetters>[1]
  )
}

function installMethods (
  proto: object,
  methodMap: Record<string, (...args: unknown[]) => unknown>
): void {
  const descriptors: PropertyDescriptorMap = {}
  for (const [methodName, method] of Object.entries(methodMap)) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(proto, methodName)
    if (originalDescriptor != null) {
      descriptors[methodName] = { ...originalDescriptor, value: method, configurable: true }
    }
  }
  Object.defineProperties(proto, descriptors)
}

const installMethodsMock = (...args: unknown[]): void => {
  installMethods(
    args[0] as object,
    args[1] as Record<string, (...args: unknown[]) => unknown>
  )
}

function installDelegationMocks (): void {
  createSafeMethodMock.mockImplementation(((ctor: { prototype: object }, methodName: string) => {
    const original = (ctor.prototype as Record<string, unknown>)[methodName]
    if (typeof original !== 'function') {
      return jest.fn()
    }
    return (instance: object, ...args: unknown[]): unknown =>
      Reflect.apply(original as (this: object, ...args: unknown[]) => unknown, instance, args)
  }) as (...args: unknown[]) => unknown)
  createSafeSetterMock.mockImplementation(((ctor: { prototype: object }, propName: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, propName)
    if (descriptor?.set == null) {
      return jest.fn()
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method -- capture native setter before patch replaces it
    const nativeSetter = descriptor.set
    return (instance: object, value: unknown): void => {
      Reflect.apply(nativeSetter, instance, [value])
    }
  }) as (...args: unknown[]) => unknown)
  redefineMethodsMock.mockImplementation(installMethodsMock)
}

function installNoOpDelegationMocks (): void {
  createSafeMethodMock.mockImplementation(() => jest.fn())
  createSafeSetterMock.mockImplementation(() => jest.fn())
  redefineMethodsMock.mockImplementation(jest.fn())
}

function setupContentWindowGetter (stubContentWindow: Window): void {
  createSafeGetterMock.mockImplementation((_ctor, prop) => {
    if (prop === 'contentWindow') {
      return () => stubContentWindow
    }
    if (prop === 'parentNode') {
      return (node: Node) => node.parentNode
    }
    return () => null
  })
}

redefinePrototypeFieldsMock.mockImplementation(installPrototypeGettersMock)

describe('iframe patch', () => {
  let iframePatch: (globalObject: GlobalScope) => undefined

  beforeAll(async () => {
    const mod = await import('@src/content_scripts/patches/iframe')
    iframePatch = mod.default
  })

  // Run before getter tests so prototypes are not already patched with no-op setters.
  describe('DOM insertion hardening', () => {
    const stubContentWindow = {} as Window

    beforeAll(() => {
      installDelegationMocks()
      setupContentWindowGetter(stubContentWindow)
      weakSetHasSafeMock.mockReturnValue(false)
      iframePatch(self)
    })

    beforeEach(() => {
      applyPatchesToGlobalObjectMock.mockClear()
      weakSetHasSafeMock.mockReturnValue(false)
    })

    it('should harden iframes already in the document at patch time', () => {
      installDelegationMocks()
      setupContentWindowGetter(stubContentWindow)
      weakSetHasSafeMock.mockReturnValue(false)
      applyPatchesToGlobalObjectMock.mockClear()

      const existing = document.createElement('iframe')
      document.body.appendChild(existing)

      iframePatch(self)

      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledWith(stubContentWindow)

      existing.remove()
    })

    it('should harden iframe when appended via appendChild', () => {
      const parent = document.createElement('div')
      const iframe = document.createElement('iframe')

      parent.appendChild(iframe)

      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledWith(stubContentWindow)
    })

    it('should harden iframe when inserted via innerHTML', () => {
      const container = document.createElement('div')

      container.innerHTML = '<iframe></iframe>'

      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledWith(stubContentWindow)
    })

    it('should harden iframe when inserted via document.write', () => {
      const frame = document.createElement('iframe')
      document.body.appendChild(frame)

      document.write('<iframe id="written-iframe"></iframe>')

      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledWith(stubContentWindow)

      frame.remove()
      document.getElementById('written-iframe')?.remove()
    })
  })

  describe('getter hardening', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      redefinePrototypeFieldsMock.mockImplementation(installPrototypeGettersMock)
      installNoOpDelegationMocks()
      weakSetHasSafeMock.mockReturnValue(true)
    })

    it('should be a no-op when HTMLIFrameElement is undefined', () => {
      const fakeGlobal = {} as unknown as GlobalScope

      iframePatch(fakeGlobal)

      expect(createSafeGetterMock).not.toHaveBeenCalled()
      expect(redefinePrototypeFieldsMock).not.toHaveBeenCalled()
    })

    it('should wrap contentWindow getter and return underlying value', () => {
      const stubContentWindow = {} as Window
      createSafeGetterMock.mockImplementation((_ctor, prop) => {
        if (prop === 'contentWindow') return () => stubContentWindow
        return () => null
      })

      iframePatch(self)

      const iframe = document.createElement('iframe')
      const result = iframe.contentWindow

      expect(createSafeGetterMock).toHaveBeenCalledTimes(4)
      expect(createSafeGetterMock).toHaveBeenCalledWith(self.HTMLIFrameElement, 'contentWindow')
      expect(createSafeGetterMock).toHaveBeenCalledWith(self.HTMLIFrameElement, 'contentDocument')
      expect(createSafeGetterMock).toHaveBeenCalledWith(self.Document, 'defaultView')
      expect(createSafeGetterMock).toHaveBeenCalledWith(self.Node, 'parentNode')
      expect(redefinePrototypeFieldsMock).toHaveBeenCalledWith(self.HTMLIFrameElement, expect.objectContaining({
        contentWindow: expect.any(Function),
        contentDocument: expect.any(Function)
      }))
      expect(result).toBe(stubContentWindow)
    })

    it('should not call weakSet when contentWindow is nullish', () => {
      createSafeGetterMock.mockImplementation((_ctor, prop) => {
        if (prop === 'contentWindow') return () => null
        return () => null
      })

      iframePatch(self)

      const iframe = document.createElement('iframe')
      const result = iframe.contentWindow

      expect(result).toBeNull()
      expect(weakSetHasSafeMock).not.toHaveBeenCalled()
      expect(weakSetAddSafeMock).not.toHaveBeenCalled()
    })

    it('should wrap contentDocument getter, harden defaultView, and return underlying document', () => {
      const stubContentWindow = {} as Window
      const stubContentDocument = {} as Document
      createSafeGetterMock.mockImplementation((_ctor, prop) => {
        if (prop === 'contentDocument') return () => stubContentDocument
        if (prop === 'defaultView') return () => stubContentWindow
        return () => null
      })
      weakSetHasSafeMock.mockReturnValue(false)

      iframePatch(self)

      const iframe = document.createElement('iframe')
      const result = iframe.contentDocument

      expect(result).toBe(stubContentDocument)
      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledTimes(1)
      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledWith(stubContentWindow)
      expect(weakSetAddSafeMock).toHaveBeenCalledWith(expect.any(WeakSet), stubContentWindow)
    })

    it('should not call weakSet when contentDocument is nullish', () => {
      createSafeGetterMock.mockImplementation((_ctor, prop) => {
        if (prop === 'contentDocument') return () => null
        return () => null
      })
      weakSetHasSafeMock.mockReturnValue(false)

      iframePatch(self)

      const iframe = document.createElement('iframe')
      const result = iframe.contentDocument

      expect(result).toBeNull()
      expect(weakSetHasSafeMock).not.toHaveBeenCalled()
      expect(weakSetAddSafeMock).not.toHaveBeenCalled()
      expect(applyPatchesToGlobalObjectMock).not.toHaveBeenCalled()
    })

    it('should harden only once when both contentDocument and contentWindow are accessed', () => {
      const stubContentWindow = {} as Window
      const stubContentDocument = {} as Document
      createSafeGetterMock.mockImplementation((_ctor, prop) => {
        if (prop === 'contentWindow') return () => stubContentWindow
        if (prop === 'contentDocument') return () => stubContentDocument
        if (prop === 'defaultView') return () => stubContentWindow
        return () => null
      })
      weakSetHasSafeMock
        .mockReturnValueOnce(false)
        .mockReturnValue(true)

      iframePatch(self)

      const iframe = document.createElement('iframe')

      expect(iframe.contentDocument).toBe(stubContentDocument)
      expect(iframe.contentWindow).toBe(stubContentWindow)

      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledTimes(1)
      expect(applyPatchesToGlobalObjectMock).toHaveBeenCalledWith(stubContentWindow)
      expect(weakSetAddSafeMock).toHaveBeenCalledTimes(1)
    })
  })
})
