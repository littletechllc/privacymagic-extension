import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'

const createSafeGetterMock = jest.fn()
const redefinePrototypeFieldsMock = jest.fn()
const weakSetHasSafeMock = jest.fn().mockReturnValue(true)
const weakSetAddSafeMock = jest.fn()
const applyPatchesToGlobalObjectMock = jest.fn()

jest.unstable_mockModule('@src/content_scripts/helpers/patch', () => ({
  applyPatchesToGlobalObject: applyPatchesToGlobalObjectMock
}))

jest.unstable_mockModule('@src/content_scripts/helpers/monkey-patch', () => ({
  createSafeGetter: createSafeGetterMock,
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

redefinePrototypeFieldsMock.mockImplementation(installPrototypeGettersMock)

describe('iframe patch', () => {
  let iframePatch: (globalObject: GlobalScope) => undefined

  beforeAll(async () => {
    const mod = await import('@src/content_scripts/patches/iframe')
    iframePatch = mod.default
  })

  beforeEach(() => {
    jest.clearAllMocks()
    redefinePrototypeFieldsMock.mockImplementation(installPrototypeGettersMock)
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

    expect(createSafeGetterMock).toHaveBeenCalledTimes(3)
    expect(createSafeGetterMock).toHaveBeenCalledWith(self.HTMLIFrameElement, 'contentWindow')
    expect(createSafeGetterMock).toHaveBeenCalledWith(self.HTMLIFrameElement, 'contentDocument')
    expect(createSafeGetterMock).toHaveBeenCalledWith(self.Document, 'defaultView')
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
