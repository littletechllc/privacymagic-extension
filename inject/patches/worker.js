/* global self, WorkerLocation */

import { reflectApplySafe, makeBundleForInjection, getDisabledSettings, getTrustedTypesPolicy } from '../helpers.js';

const worker = () => {
  const URLSafe = self.URL;
  const BlobSafe = self.Blob;
  const URLcreateObjectURLSafe = URL.createObjectURL;
  const URLhrefGetter = Object.getOwnPropertyDescriptor(URL.prototype, 'href').get;
  const URLhrefSafe = (url) => reflectApplySafe(URLhrefGetter, url, []);

  const spoofLocationInsideWorker = (absoluteUrl) => {
    // Spoof the self.location object to return the original URL.
    const absoluteUrlObject = new URL(absoluteUrl);
    const descriptors = Object.getOwnPropertyDescriptors(WorkerLocation.prototype);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor.get) {
        descriptor.get = () => absoluteUrlObject[key];
      }
    }
    Object.defineProperties(self.WorkerLocation.prototype, descriptors);
    // Modify the self.Request object to be relative to the original URL.
    const originalRequestUrlGetter = Object.getOwnPropertyDescriptor(Request.prototype, 'url').get;
    const originalRequestUrlSafe = (request) => reflectApplySafe(originalRequestUrlGetter, request, []);
    Object.defineProperty(Request.prototype, 'url', {
      get () {
        return URLhrefSafe(new URLSafe(originalRequestUrlSafe(this)));
      }
    });
    // Modify the self.fetch function to be relative to the original URL.
    const originalFetch = self.fetch;
    self.fetch = (firstArg, ...args) => {
      const resolvedFirstArg = firstArg instanceof Request
        ? firstArg
        : URLhrefSafe(new URLSafe(firstArg.toString(), absoluteUrl));
      return originalFetch(resolvedFirstArg, ...args);
    };
    // Modify the self.XMLHttpRequest object to be relative to the original URL.
    self.XMLHttpRequest = new Proxy(self.XMLHttpRequest, {
      construct (Target, [url, options]) {
        const resolvedUrl = URLhrefSafe(new URLSafe(url, absoluteUrl));
        return new Target(resolvedUrl, options);
      }
    });
  };

  // Run hardening code in workers before they are executed.
  // TODO: Do we need to worry about module blobs with relative imports?
  const prepareInjectionForWorker = (hardeningCode) => {
    const locationHref = self.location.href;
    const policy = getTrustedTypesPolicy();
    self.Worker = new Proxy(self.Worker, {
      construct (Target, [url, options]) {
        const absoluteUrl = URLhrefSafe(new URLSafe(url, locationHref));
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
