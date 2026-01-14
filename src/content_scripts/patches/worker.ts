import { createSafeGetter, makeBundleForInjection, getDisabledSettings, getTrustedTypesPolicy } from '../helpers'

const worker = (): void => {
  const URLSafe = self.URL
  const BlobSafe = self.Blob
  const URLcreateObjectURLSafe = (source: Blob | MediaSource ): string => URL.createObjectURL(source)
  const URLhrefSafe = createSafeGetter(URL, 'href')

  // Spoof the self.location object to return the original URL, and modify various
  // other objects to be relative to the original URL. This function is serialized
  // and injected into the worker context.
  const spoofLocationInsideWorker = (absoluteUrl: string): void => {
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
      if ((descriptor.get !== null && descriptor.get !== undefined) && key in absoluteUrlObject) {
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
    self.importScripts = (...paths: Array<string | URL>) => {
      const resolvedPaths: string[] = []
      for (const path of paths) {
        const resolvedPath = URLhrefSafe(new URLSafe(path, absoluteUrl))
        resolvedPaths.push(resolvedPath)
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

  const { lockObjectUrl, unlockObjectUrl, requestToRevokeObjectUrl } = (() => {
    const originalRevokeObjectURL = (url: string): void => URL.revokeObjectURL(url)

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

  self.URL.revokeObjectURL = (url: string) => {
    requestToRevokeObjectUrl(url)
  }

  const onCompletionInAnotherContext = (callback: () => void): string => {
    const broadcastChannelName = '--privacy-magic-completion--' + crypto.randomUUID()
    const broadcastChannel = new BroadcastChannel(broadcastChannelName)
    broadcastChannel.onmessage = (message: MessageEvent) => {
      const data = message?.data as { type: string } | null
      if (data?.type === 'completion') {
        callback()
      }
    }
    return `(() => {
      const broadcastChannel = new BroadcastChannel(${JSON.stringify(broadcastChannelName)});
      broadcastChannel.postMessage({ type: 'completion' });
    })();`
  }

  // Run hardening code in workers before they are executed.
  // TODO: Do we need to worry about module blobs with relative imports?
  const prepareInjectionForWorker = (hardeningCode: string): void => {
    const locationHref = self.location.href
    const policy = getTrustedTypesPolicy()
    self.Worker = new Proxy(self.Worker, {
      construct (Target, [url, options]: [string | URL, WorkerOptions?]) {
        const absoluteUrl = URLhrefSafe(new URLSafe(url, locationHref))
        let completionCallbackCode = ''
        if (absoluteUrl.startsWith('blob:')) {
          completionCallbackCode = onCompletionInAnotherContext(() => {
            unlockObjectUrl(absoluteUrl)
          })
          lockObjectUrl(absoluteUrl)
        }
        options = options ?? {}
        const importCommand = ('type' in options && options.type === 'module')
          ? 'await import'
          : 'importScripts'
        const bundle = `${hardeningCode}
        const policy = self.trustedTypes.createPolicy('sanitized-worker-policy', {
          createHTML: (unsafeHTML) => unsafeHTML,
          createScript: (unsafeScript) => unsafeScript,
          createScriptURL: (unsafeScriptURL) => unsafeScriptURL
        });
        const sanitizedAbsoluteUrl = policy.createScriptURL(${JSON.stringify(absoluteUrl)});
        (${spoofLocationInsideWorker.toString()})(${JSON.stringify(absoluteUrl)});
        try {
          ${importCommand}(sanitizedAbsoluteUrl);
        } catch (error) {
          console.error("error in importing: ", error);
        }
        ${completionCallbackCode}
        console.log("finished importing");`
        const blobUrl = URLcreateObjectURLSafe(new BlobSafe([bundle], { type: 'text/javascript' }))
        const sanitizedBlobUrl = policy.createScriptURL(blobUrl)
        return new Target(sanitizedBlobUrl, options)
      }
    })
  }

  prepareInjectionForWorker(makeBundleForInjection(getDisabledSettings()))
}

export default worker
