import { makeBundleForInjection, getDisabledSettings, resolveAbsoluteUrl } from '@src/content_scripts/helpers/helpers'
import { createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { getTrustedTypePolicyForObject, prepareInjectionForTrustedTypes } from '@src/content_scripts/helpers/trusted-types'
import { GlobalScope } from '../helpers/globalObject'

const worker = (globalObject: GlobalScope): void => {
  const BlobSafe = globalObject.Blob
  const URLSafe = globalObject.URL
  const URLcreateObjectURLSafe = (source: Blob | MediaSource): string => URLSafe.createObjectURL(source)

  // Spoof the worker's location object to return the original URL, and modify various
  // other objects to be relative to the original URL. This function is serialized
  // and injected into the worker context; it receives the worker global as second arg.
  const spoofLocationInsideWorkerFunction = (absoluteUrl: string, workerGlobal: Pick<GlobalScope, 'WorkerLocation' | 'Request' | 'Response' | 'fetch' | 'importScripts' | 'XMLHttpRequest' | 'EventSource' | 'WebSocket'> & { [k: string]: unknown }): void => {
    // We need to define these functions here because they are not available in the worker context.
    type MethodOf<TThis> = {
      [K in keyof TThis]: TThis[K] extends (...args: unknown[]) => unknown ? TThis[K] : never
    }[keyof TThis]
    const reflectApplySafe = Reflect.apply as <
      TThis,
      TMethod extends MethodOf<TThis>,
      TMethodArgs extends Parameters<TMethod>,
      TReturn extends ReturnType<TMethod>
    >(
      method: TMethod,
      thisArg: TThis,
      args: TMethodArgs
    ) => TReturn
    const hrefDescriptor = Object.getOwnPropertyDescriptor(URLSafe.prototype, 'href')
    if (hrefDescriptor?.get === undefined) {
      throw new Error('URL.href getter not found')
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const URLhrefGetter = hrefDescriptor.get as (this: URL) => string
    const URLhrefSafe = (url: URL): string => reflectApplySafe(URLhrefGetter, url, [])
    // Spoof the worker's location object to return the original URL.
    const absoluteUrlObject = new URLSafe(absoluteUrl)
    const WorkerLocation = workerGlobal.WorkerLocation
    if (WorkerLocation == null) return
    const descriptors = Object.getOwnPropertyDescriptors(WorkerLocation.prototype)
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor.get != null && key in absoluteUrlObject) {
        descriptor.get = () => absoluteUrlObject[key as keyof URL]
      }
    }
    Object.defineProperties(WorkerLocation.prototype, descriptors)
    // Modify the worker's Request object to be relative to the original URL.
    const Request = workerGlobal.Request
    const Response = workerGlobal.Response
    if (Request == null || Response == null) return
    const requestUrlDescriptor = Object.getOwnPropertyDescriptor(Request.prototype, 'url')
    if (requestUrlDescriptor?.get === undefined) {
      throw new Error('Request.url getter not found')
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalRequestUrlGetter = requestUrlDescriptor.get
    const originalRequestUrlSafe = (request: Request): string => reflectApplySafe(originalRequestUrlGetter, request, [])
    Object.defineProperty(Request.prototype, 'url', {
      get (this: Request) {
        const relativeUrl = originalRequestUrlSafe(this)
        return URLhrefSafe(new URLSafe(relativeUrl as string | URL, absoluteUrl))
      }
    })
    // Modify the worker's Response object to be relative to the original URL.
    const responseUrlDescriptor = Object.getOwnPropertyDescriptor(Response.prototype, 'url')
    if (responseUrlDescriptor?.get === undefined) {
      throw new Error('Response.url getter not found')
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalResponseUrlGetter = responseUrlDescriptor.get
    const originalResponseUrlSafe = (response: Response): string => reflectApplySafe(originalResponseUrlGetter, response, [])
    Object.defineProperty(Response.prototype, 'url', {
      get (this: Response) {
        return URLhrefSafe(new URLSafe(originalResponseUrlSafe(this), absoluteUrl))
      }
    })
    // Modify the worker's fetch function to be relative to the original URL.
    const origFetch = workerGlobal.fetch
    if (origFetch != null) {
      workerGlobal.fetch = async (...args: Parameters<typeof origFetch>) => {
        const firstArg = args[0]
        args[0] = firstArg instanceof Request
          ? firstArg
          : new URLSafe(firstArg.toString(), absoluteUrl)
        return await origFetch(...args)
      }
    }
    // Modify the worker's importScripts function to be relative to the original URL.
    const origImportScripts = workerGlobal.importScripts
    if (origImportScripts != null) {
      workerGlobal.importScripts = (...paths: Array<string | URL | TrustedScriptURL>) => {
        const resolvedPaths: Array<string | URL> = []
        for (const path of paths) {
          if (globalObject.TrustedScriptURL != null && path instanceof globalObject.TrustedScriptURL) {
            resolvedPaths.push(path.toString())
          } else {
            resolvedPaths.push(URLhrefSafe(new URLSafe(path.toString(), absoluteUrl)))
          }
        }
        return origImportScripts(...resolvedPaths)
      }
    }
    // Modify the worker's XMLHttpRequest, EventSource, and WebSocket objects to
    // be relative to the original URL.
    const constructorNames = ['XMLHttpRequest', 'EventSource', 'WebSocket'] as const
    for (const objectName of constructorNames) {
      const OriginalConstructor = workerGlobal[objectName]
      if (OriginalConstructor == null) continue
      Object.defineProperty(workerGlobal, objectName, {
        value: new Proxy(OriginalConstructor, {
          construct (
            Target,
            [url, options]: [string | URL, EventSourceInit & (string | string[] | undefined)]
          ) {
            const resolvedUrl = URLhrefSafe(new URLSafe(url, absoluteUrl))
            return new Target(resolvedUrl, options)
          }
        }),
        writable: true,
        configurable: true
      })
    }
  }

  const blobScriptCache = new WeakMap<Blob, string>()
  const blobURLScriptCache = new Map<string, string>()

  const { lockObjectUrl, unlockObjectUrl, requestToRevokeObjectUrl } = (() => {
    const originalRevokeObjectURL = globalObject.URL.revokeObjectURL.bind(globalObject.URL)

    const pendingRevocations = new Set<string>()
    const lockedUrls = new Map<string, number>()

    const isLockedObjectUrl = (url: string): boolean => {
      return (lockedUrls.get(url) ?? 0) > 0
    }

    const requestToRevokeObjectUrl = (url: string): void => {
      if (!isLockedObjectUrl(url)) {
        originalRevokeObjectURL(url)
      } else {
        pendingRevocations.add(url)
      }
    }

    const unlockObjectUrl = (url: string): void => {
      if (!isLockedObjectUrl(url)) {
        return
      }
      const lockCount = lockedUrls.get(url) ?? 0
      if (lockCount <= 1) {
        lockedUrls.delete(url)
        if (pendingRevocations.has(url)) {
          originalRevokeObjectURL(url)
          blobURLScriptCache.delete(url)
          pendingRevocations.delete(url)
        }
      } else {
        lockedUrls.set(url, lockCount - 1)
      }
    }

    const lockObjectUrl = (url: string): void => {
      const lockCount = lockedUrls.get(url) ?? 0
      lockedUrls.set(url, lockCount + 1)
    }

    return { lockObjectUrl, unlockObjectUrl, requestToRevokeObjectUrl }
  })()

  const isPotentialScript = (options: BlobPropertyBag | undefined): boolean => {
    if (options == null || 'type' in options == null) {
      return true
    }
    return (options.type === 'text/javascript' || options.type === 'application/javascript' || options.type === 'text/plain')
  }

  globalObject.Blob = new Proxy(globalObject.Blob, {
    construct (Target, [blobParts, options]: [BlobPart[], BlobPropertyBag?]) {
      const blob = new Target(blobParts, options)
      if (isPotentialScript(options)) {
        const joinedBlobParts = blobParts.filter(x => typeof x === 'string').join('\n')
        if (joinedBlobParts.length < 5000000) {
          blobScriptCache.set(blob, joinedBlobParts)
        }
      }
      return blob
    }
  })

  const originalCreateObjectURL = globalObject.URL.createObjectURL.bind(globalObject.URL)
  globalObject.URL.createObjectURL = (source: Blob | MediaSource): string => {
    const url = originalCreateObjectURL(source)
    if (source instanceof BlobSafe && blobScriptCache.has(source)) {
      const cachedScript = blobScriptCache.get(source)
      if (cachedScript != null) {
        blobURLScriptCache.set(url, cachedScript)
      }
    }
    return url
  }

  globalObject.URL.revokeObjectURL = (url: string) => {
    requestToRevokeObjectUrl(url)
  }

  const getCachedScript = (url: string): string | undefined => {
    return blobURLScriptCache.get(url)
  }

  const generateCompletionCallbackCode = (callback: () => void): string => {
    const completionType = 'completion'
    const broadcastChannelName = '--privacy-magic-completion--' + globalObject.crypto.randomUUID()
    const BroadcastChannelConstructor = globalObject.BroadcastChannel
    if (BroadcastChannelConstructor == null) throw new Error('BroadcastChannel not available')
    const broadcastChannel = new BroadcastChannelConstructor(broadcastChannelName)
    broadcastChannel.onmessage = (message: MessageEvent) => {
      const data = message?.data as { type: string } | null
      if (data?.type === completionType) {
        callback()
      }
    }
    return `(() => {
      const broadcastChannel = new BroadcastChannel(${JSON.stringify(broadcastChannelName)});
      broadcastChannel.postMessage({ type: ${jsonStringifySafe(completionType)} });
    })();`
  }

  /**
   * Create a function that will make a trusted script URL from a policy name and a URL.
   * This function is serialized and injected into the worker context.
   * @param policyName - The name of the policy to use.
   * @param url - The URL to make a trusted script URL from.
   * @returns A function that will make a trusted script URL from a policy name and a URL.
   */
  const makeTrustedScriptURLFunction = (policyName: string | undefined, url: string): TrustedScriptURL | string => {
    if (policyName == null) {
      policyName = 'default'
    }
    if (globalObject.trustedTypes == null) {
      return url
    }
    const dummyPolicy = globalObject.trustedTypes.createPolicy(policyName, {
      createScriptURL: (url) => {
        return url
      }
    })
    return dummyPolicy.createScriptURL(url)
  }

  const stringStartsWithSafe = createSafeMethod(String, 'startsWith')
  const jsonStringifySafe = JSON.stringify

  // Run hardening code in workers before they are executed.
  // TODO: Do we need to worry about module blobs with relative imports?
  const prepareInjectionForWorker = (hardeningCode: string): void => {
    const locationHref = globalObject.location.href
    let policy: TrustedTypePolicy | undefined
    if (globalObject.Worker == null) return
    globalObject.Worker = new Proxy(globalObject.Worker, {
      construct (Target, [url, options]: [string | URL | TrustedScriptURL, WorkerOptions?]) {
        if (url.toString().startsWith('chrome:') || url.toString().startsWith('chrome-extension:')) {
          // Don't harden chrome:// or chrome-extension:// URLs.
          return new Target(url.toString(), options)
        }
        let policyNameString: string | undefined = undefined
        if (globalObject.TrustedScriptURL != null && url instanceof globalObject.TrustedScriptURL) {
          policy = getTrustedTypePolicyForObject(url)
          policyNameString = policy ? jsonStringifySafe(policy?.name) : undefined
        }
        const absoluteUrl = resolveAbsoluteUrl(url.toString(), locationHref)
        let completionCallbackCode = ''
        if (stringStartsWithSafe(absoluteUrl, 'blob:')) {
          completionCallbackCode = generateCompletionCallbackCode(() => {
            unlockObjectUrl(absoluteUrl)
          })
          lockObjectUrl(absoluteUrl)
        }
        options = options ?? {}
        const importCommand = ('type' in options && options.type === 'module')
          ? 'await import'
          : 'importScripts'
        // Semicolon separated code to avoid issues with line continuations.
        const bundleWrapper = (script: string) => `
          ;${hardeningCode}
          ;(${spoofLocationInsideWorkerFunction.toString()})(${jsonStringifySafe(absoluteUrl)}, globalObject);\n
          ;${script}\n
          ;${completionCallbackCode}\n
          `
        const cachedScript = getCachedScript(absoluteUrl)
        let bundle: string
        if (cachedScript != null) {
          bundle = bundleWrapper(cachedScript);
        } else {
          bundle = bundleWrapper(`
            const trustedAbsoluteUrl = (${makeTrustedScriptURLFunction.toString()})(${policyNameString}, ${jsonStringifySafe(absoluteUrl)});
            try {
              ${importCommand}(trustedAbsoluteUrl);
              console.log("finished importing");
            } catch (error) {
              console.error("error in importing: ", error);
            }
          `);
        }
        const blobUrl = URLcreateObjectURLSafe(new BlobSafe([bundle], { type: 'text/javascript' }))
        const sanitizedBlobUrl = policy ? policy.createScriptURL(blobUrl) : blobUrl
        return new Target(sanitizedBlobUrl as string, options)
      }
    })
  }

  const hardeningCode = makeBundleForInjection(getDisabledSettings())
  prepareInjectionForTrustedTypes(globalObject, hardeningCode)
  prepareInjectionForWorker(hardeningCode)
}

export default worker
