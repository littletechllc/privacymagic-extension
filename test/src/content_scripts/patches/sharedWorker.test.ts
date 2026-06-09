import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import type { ContentSettingId } from '@src/common/setting-ids'
import sharedWorker, { type SharedWorkerPatchDeps } from '@src/content_scripts/patches/sharedWorker'

self.__disabledSettings = [] as ContentSettingId[]

const makeBundleForInjectionMock = jest.fn((_: string[]) => '/* hardening */')
const getDisabledSettingsMock = jest.fn((): ContentSettingId[] => [])
const prepareInjectionForTrustedTypesMock = jest.fn()

const sharedWorkerDeps: SharedWorkerPatchDeps = {
  makeBundleForInjection: makeBundleForInjectionMock,
  getDisabledSettings: getDisabledSettingsMock,
  prepareInjectionForTrustedTypes: prepareInjectionForTrustedTypesMock
}

function makeFakeURL () {
  const createObjectURL = jest.fn().mockReturnValue('blob:https://example.com/uuid')
  const revokeObjectURL = jest.fn()
  return Object.assign(function URL (_url?: string, _base?: string) {}, {
    createObjectURL,
    revokeObjectURL
  }) as unknown as typeof globalThis.URL
}

function makeFakeLocalStorage () {
  return {
    getItem: jest.fn(() => null),
    setItem: jest.fn()
  } as unknown as Storage
}

function makeFakeXMLHttpRequest (status = 200): typeof globalThis.XMLHttpRequest {
  function FakeXMLHttpRequest (this: void) { /* instance */ }
  FakeXMLHttpRequest.prototype.open = jest.fn()
  FakeXMLHttpRequest.prototype.send = jest.fn()
  Object.defineProperty(FakeXMLHttpRequest.prototype, 'status', {
    get () { return status },
    configurable: true
  })
  return FakeXMLHttpRequest as unknown as typeof globalThis.XMLHttpRequest
}

function makeFakeGlobalScope (overrides?: Partial<{
  SharedWorker: GlobalScope['SharedWorker']
  /** Test doubles may not match full `Blob` typing */
  Blob: typeof globalThis.Blob
  URL: typeof globalThis.URL
  localStorage: Storage
  XMLHttpRequest: typeof globalThis.XMLHttpRequest
}>): GlobalScope {
  return {
    SharedWorker: undefined,
    Blob: class Blob {},
    URL: makeFakeURL(),
    localStorage: makeFakeLocalStorage(),
    XMLHttpRequest: makeFakeXMLHttpRequest(),
    location: { href: 'https://example.com/' },
    crypto: { randomUUID: () => 'test-uuid' },
    BroadcastChannel: globalThis.BroadcastChannel,
    TrustedScriptURL: undefined,
    ...overrides
  } as unknown as GlobalScope
}

function makeOriginalSharedWorkerSpy () {
  const constructorArgs: [string, WorkerOptions | string | undefined][] = []
  function OriginalSharedWorker (this: unknown, ...args: unknown[]) {
    constructorArgs.push([String(args[0]), args[1] as WorkerOptions | string | undefined])
    return {}
  }
  const OriginalSharedWorkerSpy = jest.fn().mockImplementation(OriginalSharedWorker)
  return { OriginalSharedWorkerSpy, constructorArgs }
}

function makeStatefulLocalStorage () {
  const store = new Map<string, string>()
  return {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { store.set(key, value) })
  } as unknown as Storage
}

function makeFakeURLWithSequentialBlobs () {
  let blobCounter = 0
  const createObjectURL = jest.fn(() => `blob:https://example.com/uuid-${++blobCounter}`)
  const revokeObjectURL = jest.fn()
  return Object.assign(function URL (_url?: string, _base?: string) {}, {
    createObjectURL,
    revokeObjectURL
  }) as unknown as typeof globalThis.URL
}

function makeCachingTestScope () {
  const { OriginalSharedWorkerSpy, constructorArgs } = makeOriginalSharedWorkerSpy()
  const fakeURL = makeFakeURLWithSequentialBlobs()
  const fakeGlobal = makeFakeGlobalScope({
    SharedWorker: OriginalSharedWorkerSpy as GlobalScope['SharedWorker'],
    URL: fakeURL,
    localStorage: makeStatefulLocalStorage()
  })
  return { fakeGlobal, constructorArgs, fakeURL }
}

describe('sharedWorker patch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    makeBundleForInjectionMock.mockImplementation((_: string[]) => '/* hardening */')
    getDisabledSettingsMock.mockImplementation((): ContentSettingId[] => [])
    prepareInjectionForTrustedTypesMock.mockImplementation(() => {})
  })

  it('should be a no-op for SharedWorker when SharedWorker is undefined', () => {
    const fakeGlobal = makeFakeGlobalScope()

    sharedWorker(fakeGlobal, sharedWorkerDeps)

    expect(fakeGlobal.SharedWorker).toBeUndefined()
    expect(makeBundleForInjectionMock).not.toHaveBeenCalled()
    expect(prepareInjectionForTrustedTypesMock).not.toHaveBeenCalled()
  })

  it('should replace SharedWorker with a Proxy when SharedWorker is defined', () => {
    const { OriginalSharedWorkerSpy } = makeOriginalSharedWorkerSpy()
    const fakeGlobal = makeFakeGlobalScope({ SharedWorker: OriginalSharedWorkerSpy as GlobalScope['SharedWorker'] })

    sharedWorker(fakeGlobal, sharedWorkerDeps)

    expect(fakeGlobal.SharedWorker).toBeDefined()
    expect(fakeGlobal.SharedWorker).not.toBe(OriginalSharedWorkerSpy)
  })

  it('should pass through chrome: and chrome-extension: URLs without wrapping', () => {
    const { OriginalSharedWorkerSpy, constructorArgs } = makeOriginalSharedWorkerSpy()
    const fakeGlobal = makeFakeGlobalScope({ SharedWorker: OriginalSharedWorkerSpy as GlobalScope['SharedWorker'] })

    sharedWorker(fakeGlobal, sharedWorkerDeps)

    const SharedWorkerCtor = fakeGlobal.SharedWorker as new (url: string) => unknown
    void new SharedWorkerCtor('chrome://extension/id/script.js')
    void new SharedWorkerCtor('chrome-extension://extension-id/script.js')

    expect(constructorArgs[0][0]).toBe('chrome://extension/id/script.js')
    expect(constructorArgs[1][0]).toBe('chrome-extension://extension-id/script.js')
  })

  it('should patch URL.createObjectURL and URL.revokeObjectURL', () => {
    const fakeURL = makeFakeURL()
    const revokeSpy = jest.spyOn(fakeURL, 'revokeObjectURL')
    function MockSharedWorker (this: void) { return {} }
    const fakeGlobal = makeFakeGlobalScope({
      SharedWorker: jest.fn().mockImplementation(MockSharedWorker) as unknown as GlobalScope['SharedWorker'],
      URL: fakeURL
    })

    sharedWorker(fakeGlobal, sharedWorkerDeps)

    const SharedWorkerCtor = fakeGlobal.SharedWorker as new (url: string) => unknown
    void new SharedWorkerCtor('https://example.com/worker.js')
    fakeGlobal.URL.revokeObjectURL('blob:https://example.com/uuid')
    expect(revokeSpy).toHaveBeenCalledWith('blob:https://example.com/uuid')
  })

  it('should call makeBundleForInjection with getDisabledSettings result', () => {
    getDisabledSettingsMock.mockImplementation((): ContentSettingId[] => ['math', 'gpc'])
    const { OriginalSharedWorkerSpy } = makeOriginalSharedWorkerSpy()
    const fakeGlobal = makeFakeGlobalScope({ SharedWorker: OriginalSharedWorkerSpy as GlobalScope['SharedWorker'] })

    sharedWorker(fakeGlobal, sharedWorkerDeps)

    expect(getDisabledSettingsMock).toHaveBeenCalled()
    expect(makeBundleForInjectionMock).toHaveBeenCalledWith(['math', 'gpc'])
  })

  describe('hardened URL caching by SharedWorker name', () => {
    const scriptUrl = 'https://example.com/worker.js'

    it('should reuse the same hardened URL when the SharedWorker name is the same', () => {
      const { fakeGlobal, constructorArgs, fakeURL } = makeCachingTestScope()
      sharedWorker(fakeGlobal, sharedWorkerDeps)

      const SharedWorkerCtor = fakeGlobal.SharedWorker as new (
        url: string,
        options?: WorkerOptions | string
      ) => unknown
      const options = { name: 'shared-a' }
      void new SharedWorkerCtor(scriptUrl, options)
      void new SharedWorkerCtor(scriptUrl, options)

      expect(constructorArgs[0][0]).toBe('blob:https://example.com/uuid-1')
      expect(constructorArgs[1][0]).toBe('blob:https://example.com/uuid-1')
      expect(fakeURL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(fakeGlobal.localStorage.setItem).toHaveBeenCalledTimes(1)
    })

    it('should use different hardened URLs when the SharedWorker name is different', () => {
      const { fakeGlobal, constructorArgs, fakeURL } = makeCachingTestScope()
      sharedWorker(fakeGlobal, sharedWorkerDeps)

      const SharedWorkerCtor = fakeGlobal.SharedWorker as new (
        url: string,
        options?: WorkerOptions | string
      ) => unknown
      void new SharedWorkerCtor(scriptUrl, { name: 'shared-a' })
      void new SharedWorkerCtor(scriptUrl, { name: 'shared-b' })

      expect(constructorArgs[0][0]).toBe('blob:https://example.com/uuid-1')
      expect(constructorArgs[1][0]).toBe('blob:https://example.com/uuid-2')
      expect(constructorArgs[0][0]).not.toBe(constructorArgs[1][0])
      expect(fakeURL.createObjectURL).toHaveBeenCalledTimes(2)
      expect(fakeGlobal.localStorage.setItem).toHaveBeenCalledTimes(2)
    })
  })
})
