import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'

const makeBundleForInjectionMock = jest.fn().mockReturnValue('/* hardening */')
const getDisabledSettingsMock = jest.fn().mockReturnValue([])
const resolveAbsoluteUrlMock = jest.fn((url: string) => url)
const getTrustedTypePolicyForObjectMock = jest.fn().mockReturnValue(undefined)
const prepareInjectionForTrustedTypesMock = jest.fn()
const createSafeMethodMock = jest.fn().mockImplementation((..._args: unknown[]) => {
  return (str: string, prefix: string) => String.prototype.startsWith.call(str, prefix)
})

jest.unstable_mockModule('@src/content_scripts/helpers/helpers', () => ({
  makeBundleForInjection: makeBundleForInjectionMock,
  getDisabledSettings: getDisabledSettingsMock,
  resolveAbsoluteUrl: resolveAbsoluteUrlMock
}))

jest.unstable_mockModule('@src/content_scripts/helpers/trusted-types', () => ({
  getTrustedTypePolicyForObject: getTrustedTypePolicyForObjectMock,
  prepareInjectionForTrustedTypes: prepareInjectionForTrustedTypesMock
}))

jest.unstable_mockModule('@src/content_scripts/helpers/monkey-patch', () => ({
  createSafeMethod: createSafeMethodMock
}))

let workerPatch: (globalObject: GlobalScope) => void

function makeFakeURL () {
  const createObjectURL = jest.fn().mockReturnValue('blob:https://example.com/uuid')
  const revokeObjectURL = jest.fn()
  return Object.assign(function URL (_url?: string, _base?: string) {}, {
    createObjectURL,
    revokeObjectURL
  }) as unknown as typeof globalThis.URL
}

beforeAll(async () => {
  const mod = await import('@src/content_scripts/patches/worker')
  workerPatch = mod.default
})

describe('worker patch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    makeBundleForInjectionMock.mockReturnValue('/* hardening */')
    getDisabledSettingsMock.mockReturnValue([])
    resolveAbsoluteUrlMock.mockImplementation((url: string) => url)
    getTrustedTypePolicyForObjectMock.mockReturnValue(undefined)
    createSafeMethodMock.mockImplementation((..._args: unknown[]) => {
      return (str: string, prefix: string) => String.prototype.startsWith.call(str, prefix)
    })
  })

  it('should be a no-op for Worker when Worker is undefined', () => {
    const fakeGlobal = {
      Worker: undefined,
      Blob: class Blob {},
      URL: makeFakeURL(),
      location: { href: 'https://example.com/' },
      crypto: { randomUUID: () => 'test-uuid' },
      BroadcastChannel: globalThis.BroadcastChannel,
      TrustedScriptURL: undefined
    } as unknown as GlobalScope

    workerPatch(fakeGlobal)

    expect(fakeGlobal.Worker).toBeUndefined()
    expect(makeBundleForInjectionMock).toHaveBeenCalled()
    expect(prepareInjectionForTrustedTypesMock).toHaveBeenCalledWith(fakeGlobal, '/* hardening */')
  })

  it('should replace Worker with a Proxy when Worker is defined', () => {
    function OriginalWorker (this: unknown, ..._args: unknown[]) {
      return Object.create(OriginalWorker.prototype)
    }
    const OriginalWorkerSpy = jest.fn().mockImplementation(OriginalWorker)
    const fakeGlobal = {
      Worker: OriginalWorkerSpy,
      Blob: class Blob {},
      URL: makeFakeURL(),
      location: { href: 'https://example.com/' },
      crypto: { randomUUID: () => 'test-uuid' },
      BroadcastChannel: globalThis.BroadcastChannel,
      TrustedScriptURL: undefined
    } as unknown as GlobalScope

    workerPatch(fakeGlobal)

    expect(fakeGlobal.Worker).toBeDefined()
    expect(fakeGlobal.Worker).not.toBe(OriginalWorkerSpy)
  })

  it('should pass through chrome: and chrome-extension: URLs without wrapping', () => {
    const constructorArgs: [string, WorkerOptions?][] = []
    function OriginalWorker (this: unknown, ...args: unknown[]) {
      constructorArgs.push([String(args[0]), args[1] as WorkerOptions | undefined])
      return Object.create(OriginalWorker.prototype)
    }
    const OriginalWorkerMock = jest.fn().mockImplementation(OriginalWorker)
    const fakeGlobal = {
      Worker: OriginalWorkerMock,
      Blob: class Blob {},
      URL: makeFakeURL(),
      location: { href: 'https://example.com/' },
      crypto: { randomUUID: () => 'test-uuid' },
      BroadcastChannel: globalThis.BroadcastChannel,
      TrustedScriptURL: undefined
    } as unknown as GlobalScope

    workerPatch(fakeGlobal)

    new (fakeGlobal.Worker as typeof Worker)('chrome://extension/id/script.js')
    new (fakeGlobal.Worker as typeof Worker)('chrome-extension://extension-id/script.js')

    expect(constructorArgs[0][0]).toBe('chrome://extension/id/script.js')
    expect(constructorArgs[1][0]).toBe('chrome-extension://extension-id/script.js')
  })

  it('should replace Blob with a Proxy', () => {
    const OriginalBlob = class Blob {
      constructor (public parts: BlobPart[], public options?: BlobPropertyBag) {}
    }
    function MockWorker (this: unknown) { return Object.create(MockWorker.prototype) }
    const fakeGlobal = {
      Worker: jest.fn().mockImplementation(MockWorker),
      Blob: OriginalBlob,
      URL: makeFakeURL(),
      location: { href: 'https://example.com/' },
      crypto: { randomUUID: () => 'test-uuid' },
      BroadcastChannel: globalThis.BroadcastChannel,
      TrustedScriptURL: undefined
    } as unknown as GlobalScope

    workerPatch(fakeGlobal)

    expect(fakeGlobal.Blob).not.toBe(OriginalBlob)
    const blob = new (fakeGlobal.Blob as typeof globalThis.Blob)(['const x = 1'], { type: 'text/javascript' })
    expect(blob).toBeInstanceOf(OriginalBlob)
  })

  it('should patch URL.createObjectURL and URL.revokeObjectURL', () => {
    const fakeURL = makeFakeURL()
    const originalRevokeObjectURL = fakeURL.revokeObjectURL as jest.Mock
    function MockWorker (this: unknown) { return Object.create(MockWorker.prototype) }
    const fakeGlobal = {
      Worker: jest.fn().mockImplementation(MockWorker),
      Blob: class Blob {},
      URL: fakeURL,
      location: { href: 'https://example.com/' },
      crypto: { randomUUID: () => 'test-uuid' },
      BroadcastChannel: globalThis.BroadcastChannel,
      TrustedScriptURL: undefined
    } as unknown as GlobalScope

    workerPatch(fakeGlobal)

    expect(fakeGlobal.URL.createObjectURL).toBeDefined()
    expect(fakeGlobal.URL.revokeObjectURL).toBeDefined()
    fakeGlobal.URL.revokeObjectURL('blob:https://example.com/uuid')
    expect(originalRevokeObjectURL).toHaveBeenCalledWith('blob:https://example.com/uuid')
  })

  it('should call makeBundleForInjection with getDisabledSettings result', () => {
    getDisabledSettingsMock.mockReturnValue(['math', 'gpc'])
    const fakeGlobal = {
      Worker: undefined,
      Blob: class Blob {},
      URL: makeFakeURL(),
      location: { href: 'https://example.com/' },
      crypto: { randomUUID: () => 'test-uuid' },
      BroadcastChannel: globalThis.BroadcastChannel,
      TrustedScriptURL: undefined
    } as unknown as GlobalScope

    workerPatch(fakeGlobal)

    expect(getDisabledSettingsMock).toHaveBeenCalled()
    expect(makeBundleForInjectionMock).toHaveBeenCalledWith(['math', 'gpc'])
  })
})
