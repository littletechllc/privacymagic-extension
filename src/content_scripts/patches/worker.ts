import { reflectApplySafe, makeBundleForInjection, getDisabledSettings, getTrustedTypesPolicy } from '../helpers';

const worker = () => {
  const URLSafe = self.URL;
  const BlobSafe = self.Blob;
  const URLcreateObjectURLSafe = URL.createObjectURL;
  const URLhrefGetter = Object.getOwnPropertyDescriptor(URL.prototype, 'href')!.get!;
  const URLhrefSafe = (url: URL) => reflectApplySafe(URLhrefGetter, url, []);

  // Spoof the self.location object to return the original URL, and modify various
  // other objects to be relative to the original URL. This function is serialized
  // and injected into the worker context.
  const spoofLocationInsideWorker = (absoluteUrl: string) => {
    // We need to define these functions here because they are not available in the worker context.
    const reflectApplySafe = <T extends (...args: any[]) => any, TThis = any>(
      func: T,
      thisArg: TThis,
      args: Parameters<T>
    ): ReturnType<T> | undefined => {
      try {
        return Reflect.apply(func, thisArg, args);
      } catch (error) {
        return undefined;
      }
    };
    const URLSafe = self.URL;
    const URLhrefGetter = Object.getOwnPropertyDescriptor(URL.prototype, 'href')!.get!;
    const URLhrefSafe = (url: URL) => reflectApplySafe(URLhrefGetter, url, []);
    // Spoof the self.location object to return the original URL.
    const absoluteUrlObject = new URL(absoluteUrl);
    const descriptors = Object.getOwnPropertyDescriptors(WorkerLocation.prototype);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor.get && key in absoluteUrlObject) {
        descriptor.get = () => absoluteUrlObject[key as keyof URL];
      }
    }
    Object.defineProperties(self.WorkerLocation.prototype, descriptors);
    // Modify the self.Request object to be relative to the original URL.
    const originalRequestUrlGetter = Object.getOwnPropertyDescriptor(Request.prototype, 'url')!.get!;
    const originalRequestUrlSafe = (request: Request) => reflectApplySafe(originalRequestUrlGetter, request, []);
    Object.defineProperty(Request.prototype, 'url', {
      get () {
        return URLhrefSafe(new URLSafe(originalRequestUrlSafe(this), absoluteUrl));
      }
    });
    // Modify the self.Response object to be relative to the original URL.
    const originalResponseUrlGetter = Object.getOwnPropertyDescriptor(Response.prototype, 'url')!.get!;
    const originalResponseUrlSafe = (response: Response) => reflectApplySafe(originalResponseUrlGetter, response, []);
    Object.defineProperty(Response.prototype, 'url', {
      get () {
        return URLhrefSafe(new URLSafe(originalResponseUrlSafe(this), absoluteUrl));
      }
    });
    // Modify the self.fetch function to be relative to the original URL.
    const originalFetch = self.fetch;
    self.fetch = (firstArg: URL | Request | string, ...args: any[]) => {
      const resolvedFirstArg : URL | Request = firstArg instanceof Request
        ? firstArg
        : URLhrefSafe(new URLSafe(firstArg.toString(), absoluteUrl));
      return originalFetch(resolvedFirstArg, ...args);
    };
    // Modify the self.importScripts function to be relative to the original URL.
    const originalImportScripts = self.importScripts;
    self.importScripts = (...paths: (string | URL)[]) => {
      const resolvedPaths: string[] = [];
      for (const path of paths) {
        const resolvedPath = URLhrefSafe(new URLSafe(path, absoluteUrl));
        resolvedPaths.push(resolvedPath);
      }
      return originalImportScripts(...resolvedPaths);
    };
    // Modify the self.XMLHttpRequest, self.EventSource, and self.WebSocket objects to
    // be relative to the original URL.
    const constructorNames = ['XMLHttpRequest', 'EventSource', 'WebSocket'] as const;
    for (const objectName of constructorNames) {
      const OriginalConstructor = self[objectName as keyof typeof self];
      Object.defineProperty(self, objectName, {
        value: new Proxy(OriginalConstructor, {
          construct (Target, [url, options]: [string | URL, any?]) {
            const resolvedUrl = URLhrefSafe(new URLSafe(url, absoluteUrl));
            return new Target(resolvedUrl, options);
          }
        }),
        writable: true,
        configurable: true
      });
    }
  };

  const { lockObjectUrl, unlockObjectUrl, requestToRevokeObjectUrl } = (() => {
    const originalRevokeObjectURL = self.URL.revokeObjectURL;

    const pendingRevocations = new Set();
    const lockedUrls = new Map();

    const isLockedObjectUrl = (url: string) => {
      return (lockedUrls.get(url) ?? 0) > 0;
    };

    const requestToRevokeObjectUrl = (url: string) => {
      if (!isLockedObjectUrl(url)) {
        originalRevokeObjectURL(url);
      } else {
        pendingRevocations.add(url);
      }
    };

    const unlockObjectUrl = (url: string) => {
      if (!isLockedObjectUrl(url)) {
        return;
      }
      const lockCount = lockedUrls.get(url)!;
      if (lockCount <= 1) {
        lockedUrls.delete(url);
        if (pendingRevocations.has(url)) {
          originalRevokeObjectURL(url);
          pendingRevocations.delete(url);
        }
      } else {
        lockedUrls.set(url, lockCount - 1);
      }
    };

    const lockObjectUrl = (url: string) => {
      const lockCount = lockedUrls.get(url) ?? 0;
      lockedUrls.set(url, lockCount + 1);
    };

    return { lockObjectUrl, unlockObjectUrl, requestToRevokeObjectUrl };
  })();

  self.URL.revokeObjectURL = (url: string) => {
    requestToRevokeObjectUrl(url);
  };

  const onCompletionInAnotherContext = (callback: () => void) => {
    const broadcastChannelName = '--privacy-magic-completion--' + crypto.randomUUID();
    const broadcastChannel = new BroadcastChannel(broadcastChannelName);
    broadcastChannel.onmessage = (message: MessageEvent) => {
      if (message.data.type === 'completion') {
        callback();
      }
    };
    return `(() => {
      const broadcastChannel = new BroadcastChannel(${JSON.stringify(broadcastChannelName)});
      broadcastChannel.postMessage({ type: 'completion' });
    })();`;
  };

  // Run hardening code in workers before they are executed.
  // TODO: Do we need to worry about module blobs with relative imports?
  const prepareInjectionForWorker = (hardeningCode: string) => {
    const locationHref = self.location.href;
    const policy = getTrustedTypesPolicy();
    self.Worker = new Proxy(self.Worker, {
      construct (Target, [url, options]: [string | URL, WorkerOptions?]) {
        const absoluteUrl = URLhrefSafe(new URLSafe(url, locationHref));
        let completionCallbackCode = '';
        if (absoluteUrl.startsWith('blob:')) {
          completionCallbackCode = onCompletionInAnotherContext(() => {
            unlockObjectUrl(absoluteUrl);
          });
          lockObjectUrl(absoluteUrl);
        }
        options = options ?? {};
        const importCommand = ('type' in options && options.type === 'module')
          ? 'await import'
          : 'importScripts';
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
        console.log("finished importing");`;
        const blobUrl = URLcreateObjectURLSafe(new BlobSafe([bundle], { type: 'text/javascript' }));
        const sanitizedBlobUrl = policy.createScriptURL(blobUrl);
        return new Target(sanitizedBlobUrl, options);
      }
    });
  };

  return prepareInjectionForWorker(makeBundleForInjection(getDisabledSettings()));
};

export default worker;
