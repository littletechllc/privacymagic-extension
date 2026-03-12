import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'

const createSafeGetterMock = jest.fn()
const weakSetHasSafeMock = jest.fn().mockReturnValue(true)
const weakSetAddSafeMock = jest.fn()

jest.unstable_mockModule('@src/content_scripts/helpers/patch', () => ({
  applyPatchesToGlobalObject: jest.fn()
}))

jest.unstable_mockModule('@src/content_scripts/helpers/monkey-patch', () => ({
  createSafeGetter: createSafeGetterMock
}))

jest.unstable_mockModule('@src/content_scripts/helpers/safe', () => ({
  weakSetHasSafe: weakSetHasSafeMock,
  weakSetAddSafe: weakSetAddSafeMock
}))

describe('iframe patch', () => {
  let iframePatch: (globalObject: GlobalScope) => undefined

  beforeAll(async () => {
    const mod = await import('@src/content_scripts/patches/iframe')
    iframePatch = mod.default
  })

  beforeEach(() => {
    jest.clearAllMocks()
    weakSetHasSafeMock.mockReturnValue(true)
  })

  it('should be a no-op when HTMLIFrameElement is undefined', () => {
    const fakeGlobal = {} as unknown as GlobalScope

    iframePatch(fakeGlobal)

    expect(createSafeGetterMock).not.toHaveBeenCalled()
  })

  it('should wrap contentWindow getter and return underlying value', () => {
    const stubContentWindow = {} as Window

    createSafeGetterMock.mockReturnValue(() => stubContentWindow)

    iframePatch(self as unknown as GlobalScope)

    const iframe = document.createElement('iframe')
    const result = iframe.contentWindow

    expect(createSafeGetterMock).toHaveBeenCalledTimes(1)
    const expectedCtor = (self as unknown as GlobalScope).HTMLIFrameElement
    expect(createSafeGetterMock.mock.calls[0]).toEqual([expectedCtor, 'contentWindow'])
    expect(result).toBe(stubContentWindow)
  })

  it('should not call weakSet when getter returns nullish', () => {
    createSafeGetterMock.mockReturnValue(() => null)

    iframePatch(self as unknown as GlobalScope)

    const iframe = document.createElement('iframe')
    const result = iframe.contentWindow

    expect(result).toBeNull()
    // When contentWindow is null, code short-circuits and never touches the WeakSet
    expect(weakSetHasSafeMock).not.toHaveBeenCalled()
    expect(weakSetAddSafeMock).not.toHaveBeenCalled()
  })
})
