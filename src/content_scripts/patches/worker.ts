import { makeBundleForInjection, getDisabledSettings } from '@src/content_scripts/helpers/helpers'
import { createSafeGetter, createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { getTrustedTypePolicyForObject, prepareInjectionForTrustedTypes } from '@src/content_scripts/helpers/trusted-types'

const worker = (): void => {
  const URLSafe = self.URL
  const BlobSafe = self.Blob
  const URLcreateObjectURLSafe = (source: Blob | MediaSource ): string => URL.createObjectURL(source)
  const URLhrefSafe = createSafeGetter(URL, 'href')

  // Spoof the self.location object to return the original URL, and modify various
  // other objects to be relative to the original URL. This function is serialized
  // and injected into the worker context.
  const spoofLocationInsideWorkerFunction = (absoluteUrl: string): void => {
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
    const URLSafe = self.URL
    const hrefDescriptor = Object.getOwnPropertyDescriptor(URL.prototype, 'href')
    if (hrefDescriptor?.get === undefined) {
      throw new Error('URL.href getter not found')
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const URLhrefGetter = hrefDescriptor.get as (this: URL) => string
    const URLhrefSafe = (url: URL): string => reflectApplySafe(URLhrefGetter, url, [])
    // Spoof the self.location object to return the original URL.
    const absoluteUrlObject = new URL(absoluteUrl)
    const descriptors = Object.getOwnPropertyDescriptors(WorkerLocation.prototype)
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor.get != null && key in absoluteUrlObject) {
        descriptor.get = () => absoluteUrlObject[key as keyof URL]
      }
    }
    Object.defineProperties(self.WorkerLocation.prototype, descriptors)
    // Modify the self.Request object to be relative to the original URL.
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
    // Modify the self.Response object to be relative to the original URL.
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
    // Modify the self.fetch function to be relative to the original URL.
    const originalFetch = self.fetch
    self.fetch = async (...args: Parameters<typeof originalFetch>) => {
      const firstArg = args[0]
      args[0] = firstArg instanceof Request
        ? firstArg
        : new URLSafe(firstArg.toString(), absoluteUrl)
      return await originalFetch(...args)
    }
    // Modify the self.importScripts function to be relative to the original URL.
    const originalImportScripts = self.importScripts
    self.importScripts = (...paths: Array<string | URL | TrustedScriptURL>) => {
      console.log('importScripts paths:', paths)
      const resolvedPaths: Array<string | URL | TrustedScriptURL> = []
      for (const path of paths) {
        if (path instanceof TrustedScriptURL) {
          resolvedPaths.push(path)
        } else {
          const resolvedPath = URLhrefSafe(new URLSafe(path, absoluteUrl))
          resolvedPaths.push(resolvedPath)
        }
      }
      return originalImportScripts(...resolvedPaths)
    }
    // Modify the self.XMLHttpRequest, self.EventSource, and self.WebSocket objects to
    // be relative to the original URL.
    const constructorNames = ['XMLHttpRequest', 'EventSource', 'WebSocket'] as const
    for (const objectName of constructorNames) {
      const OriginalConstructor = self[objectName]
      Object.defineProperty(self, objectName, {
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
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL)

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

  self.Blob = new Proxy(self.Blob, {
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

  const originalCreateObjectURL = self.URL.createObjectURL.bind(self.URL)
  self.URL.createObjectURL = (source: Blob | MediaSource): string => {
    const url = originalCreateObjectURL(source)
    if (source instanceof Blob && blobScriptCache.has(source)) {
      const cachedScript = blobScriptCache.get(source)
      if (cachedScript != null) {
        blobURLScriptCache.set(url, cachedScript)
      }
    }
    return url
  }

  self.URL.revokeObjectURL = (url: string) => {
    requestToRevokeObjectUrl(url)
  }

  const getCachedScript = (url: string): string | undefined => {
    return blobURLScriptCache.get(url)
  }

  const generateCompletionCallbackCode = (callback: () => void): string => {
    const completionType = 'completion'
    const broadcastChannelName = '--privacy-magic-completion--' + crypto.randomUUID()
    const broadcastChannel = new BroadcastChannel(broadcastChannelName)
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
    if (self.trustedTypes == null) {
      return url
    }
    const dummyPolicy = self.trustedTypes.createPolicy(policyName, {
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
    const locationHref = self.location.href
    let policy: TrustedTypePolicy | undefined
    self.Worker = new Proxy(self.Worker, {
      construct (Target, [url, options]: [string | URL | TrustedScriptURL, WorkerOptions?]) {
        console.log(' New Worker url:', url, 'document =', self.document);
        if (url.toString().startsWith('chrome:') || url.toString().startsWith('chrome-extension:')) {
          // Don't harden chrome:// or chrome-extension:// URLs.
          return new Target(url.toString(), options)
        }
        let policyNameString: string | undefined = undefined
        if (url instanceof TrustedScriptURL) {
          policy = getTrustedTypePolicyForObject(url)
          policyNameString = policy ? jsonStringifySafe(policy?.name) : undefined
        }
        console.log('policyNameString:', policyNameString);
        const absoluteUrl = URLhrefSafe(new URLSafe(url as string | URL, locationHref))
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
        const bundleWrapper = (script: string) => `
          ${hardeningCode}
          (${spoofLocationInsideWorkerFunction.toString()})(${jsonStringifySafe(absoluteUrl)});
          ///// ------------------------------------------------------------ /////
          ${script}
          ///// ------------------------------------------------------------ /////
          ${completionCallbackCode}
        `;
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
        console.log('policy:', policy);
        const sanitizedBlobUrl = policy ? policy.createScriptURL(blobUrl) : blobUrl
        return new Target(sanitizedBlobUrl as string, options)
      }
    })
  }

  const hardeningCode = makeBundleForInjection(getDisabledSettings())
  prepareInjectionForTrustedTypes(hardeningCode)
  prepareInjectionForWorker(hardeningCode)
}

export default worker
