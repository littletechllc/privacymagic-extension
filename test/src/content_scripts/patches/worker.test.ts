import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import type { ContentSettingId } from '@src/common/setting-ids'
import worker, { type WorkerPatchDeps } from '@src/content_scripts/patches/worker'

self.__disabledSettings = [] as ContentSettingId[]

const makeBundleForInjectionMock = jest.fn((_: string[]) => '/* hardening */')
const getDisabledSettingsMock = jest.fn((): ContentSettingId[] => [])
const prepareInjectionForTrustedTypesMock = jest.fn()

const workerDeps: WorkerPatchDeps = {
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

function makeFakeGlobalScope (overrides?: Partial<{
  Worker: GlobalScope['Worker']
  /** Test doubles may not match full `Blob` typing */
  Blob: typeof globalThis.Blob
  URL: typeof globalThis.URL
}>): GlobalScope {
  return {
    Worker: undefined,
    Blob: class Blob {},
    URL: makeFakeURL(),
    location: { href: 'https://example.com/' },
    crypto: { randomUUID: () => 'test-uuid' },
    BroadcastChannel: globalThis.BroadcastChannel,
    TrustedScriptURL: undefined,
    ...overrides
  } as unknown as GlobalScope
}

describe('worker patch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    makeBundleForInjectionMock.mockImplementation((_: string[]) => '/* hardening */')
    getDisabledSettingsMock.mockImplementation((): ContentSettingId[] => [])
    prepareInjectionForTrustedTypesMock.mockImplementation(() => {})
  })

  it('should be a no-op for Worker when Worker is undefined', () => {
    const fakeGlobal = makeFakeGlobalScope()

    worker(fakeGlobal, workerDeps)

    expect(fakeGlobal.Worker).toBeUndefined()
    expect(makeBundleForInjectionMock).toHaveBeenCalled()
    expect(prepareInjectionForTrustedTypesMock.mock.calls[0]).toEqual([fakeGlobal, '/* hardening */'])
  })

  it('should replace Worker with a Proxy when Worker is defined', () => {
    function OriginalWorker (this: unknown, ..._args: unknown[]) {
      return {}
    }
    const OriginalWorkerSpy = jest.fn().mockImplementation(OriginalWorker)
    const fakeGlobal = makeFakeGlobalScope({ Worker: OriginalWorkerSpy as GlobalScope['Worker'] })

    worker(fakeGlobal, workerDeps)

    expect(fakeGlobal.Worker).toBeDefined()
    expect(fakeGlobal.Worker).not.toBe(OriginalWorkerSpy)
  })

  it('should pass through chrome: and chrome-extension: URLs without wrapping', () => {
    const constructorArgs: [string, WorkerOptions?][] = []
    function OriginalWorker (this: unknown, ...args: unknown[]) {
      constructorArgs.push([String(args[0]), args[1] as WorkerOptions | undefined])
      return {}
    }
    const OriginalWorkerMock = jest.fn().mockImplementation(OriginalWorker)
    const fakeGlobal = makeFakeGlobalScope({ Worker: OriginalWorkerMock as GlobalScope['Worker'] })

    worker(fakeGlobal, workerDeps)

    const WorkerCtor = fakeGlobal.Worker as new (url: string) => unknown
    void new WorkerCtor('chrome://extension/id/script.js')
    void new WorkerCtor('chrome-extension://extension-id/script.js')

    expect(constructorArgs[0][0]).toBe('chrome://extension/id/script.js')
    expect(constructorArgs[1][0]).toBe('chrome-extension://extension-id/script.js')
  })

  it('should replace Blob with a Proxy', () => {
    const OriginalBlob = class Blob {
      constructor (public parts: BlobPart[], public options?: BlobPropertyBag) {}
    }
    function MockWorker (this: void) { return {} }
    const fakeGlobal = makeFakeGlobalScope({
      Worker: jest.fn().mockImplementation(MockWorker) as unknown as GlobalScope['Worker'],
      Blob: OriginalBlob as unknown as typeof globalThis.Blob
    })

    worker(fakeGlobal, workerDeps)

    expect(fakeGlobal.Blob).not.toBe(OriginalBlob)
    const BlobCtor = fakeGlobal.Blob as new (parts: BlobPart[], options?: BlobPropertyBag) => Blob
    const blob = new BlobCtor(['const x = 1'], { type: 'text/javascript' })
    expect(blob).toBeInstanceOf(OriginalBlob)
  })

  it('should patch URL.createObjectURL and URL.revokeObjectURL', () => {
    const fakeURL = makeFakeURL()
    const revokeSpy = jest.spyOn(fakeURL, 'revokeObjectURL')
    function MockWorker (this: void) { return {} }
    const fakeGlobal = makeFakeGlobalScope({
      Worker: jest.fn().mockImplementation(MockWorker) as unknown as GlobalScope['Worker'],
      URL: fakeURL
    })

    worker(fakeGlobal, workerDeps)

    fakeGlobal.URL.revokeObjectURL('blob:https://example.com/uuid')
    expect(revokeSpy).toHaveBeenCalledWith('blob:https://example.com/uuid')
  })

  it('should call makeBundleForInjection with getDisabledSettings result', () => {
    getDisabledSettingsMock.mockImplementation((): ContentSettingId[] => ['math', 'gpc'])
    const fakeGlobal = makeFakeGlobalScope()

    worker(fakeGlobal, workerDeps)

    expect(getDisabledSettingsMock).toHaveBeenCalled()
    expect(makeBundleForInjectionMock).toHaveBeenCalledWith(['math', 'gpc'])
  })
})
