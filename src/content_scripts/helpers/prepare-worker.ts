import { createSafeGetter, createSafeMethod, redefineMethods, redefinePrototypeFields } from "./monkey-patch";
import { resolveAbsoluteUrl } from "./safe";

export const prepareWorker = (workerGlobal: WorkerGlobalScope, absoluteUrl: string): void => {
  // Spoof the worker's location object to return the absoluteURL.
  (() => {
    const { href, protocol, host, hostname, port, pathname, search, hash, origin } = new URL(absoluteUrl)
    redefinePrototypeFields(WorkerLocation, {
      href,
      protocol,
      host,
      hostname,
      port,
      pathname,
      search,
      hash,
      origin
    })
  })()
  // Rewrite the Request object's URL property to be relative to the
  // spoofed worker location URL.
  const getRequestUrlSafe = createSafeGetter(Request, 'url')
  const origRequestUrlDescriptor = Object.getOwnPropertyDescriptor(Request.prototype, 'url')
  Object.defineProperty(Request.prototype, 'url', {
    ...origRequestUrlDescriptor,
    get(this: Request) {
      return resolveAbsoluteUrl(getRequestUrlSafe(this), absoluteUrl)
    }
  })
  // Rewrite the Response object's URL property to be relative to the
  // spoofed worker location URL.
  const getResponseUrlSafe = createSafeGetter(Response, 'url')
  const origResponseUrlDescriptor = Object.getOwnPropertyDescriptor(Response.prototype, 'url')
  Object.defineProperty(Response.prototype, 'url', {
    ...origResponseUrlDescriptor,
    get(this: Response) {
      return resolveAbsoluteUrl(getResponseUrlSafe(this), absoluteUrl)
    }
  })
  // Rewrite the Fetch API to be relative to the spoofed worker location URL.
  const origFetch = workerGlobal.fetch.bind(workerGlobal)
  redefineMethods(workerGlobal, {
    fetch: async (...args: Parameters<typeof fetch>) => {
      const firstArg = args[0]
      args[0] = firstArg instanceof workerGlobal.Request
        ? firstArg
        : resolveAbsoluteUrl(firstArg.toString(), absoluteUrl)
      return await origFetch(...args)
    }
  })
  // Rewrite the XMLHttpRequest object to be relative to the spoofed worker location URL.
  const xmlHttpRequestOpenSafe = createSafeMethod(workerGlobal.XMLHttpRequest, 'open')
  redefineMethods(workerGlobal.XMLHttpRequest.prototype, {
    open: function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async: boolean,
      user?: string | null,
      password?: string | null
    ) {
      const resolvedUrl = resolveAbsoluteUrl(url, absoluteUrl)
      return xmlHttpRequestOpenSafe(this, method, resolvedUrl, async, user, password)
    }
  })
  // Rewrite the EventSource object to be relative to the spoofed worker location URL.
  const origEventSourceConstructor = workerGlobal.EventSource
  workerGlobal.EventSource = new Proxy(origEventSourceConstructor, {
    construct(Target: typeof EventSource, args: ConstructorParameters<typeof EventSource>) {
      const resolvedUrl = resolveAbsoluteUrl(args[0], absoluteUrl)
      args[0] = resolvedUrl
      return new Target(...args)
    }
  })
  // Rewrite the WebSocket object to be relative to the spoofed worker location URL.
  const origWebSocketConstructor = workerGlobal.WebSocket
  workerGlobal.WebSocket = new Proxy(origWebSocketConstructor, {
    construct(Target: typeof WebSocket, args: ConstructorParameters<typeof WebSocket>) {
      const resolvedUrl = resolveAbsoluteUrl(args[0], absoluteUrl)
      args[0] = resolvedUrl
      return new Target(...args)
    }
  })
  // Rewrite the createScriptURL method to be relative to the spoofed worker location URL.
  const origCreateScriptURL = createSafeMethod(workerGlobal.TrustedTypePolicy, 'createScriptURL')
  redefineMethods(workerGlobal.TrustedTypePolicy.prototype, {
    createScriptURL: function (this: TrustedTypePolicy, input: string | TrustedScriptURL, ...rest: unknown[]): TrustedScriptURL {
      const resolvedInput = resolveAbsoluteUrl(String(input), absoluteUrl)
      return origCreateScriptURL(this, resolvedInput, ...rest)
    }
  })
  // Rewrite the importScripts method to be relative to the spoofed worker location URL.
  type ImportScriptsArguments = Array<string | URL | TrustedScriptURL>
  const origImportScripts = (workerGlobal.importScripts as (...paths: ImportScriptsArguments) => void).bind(workerGlobal)
  redefineMethods(workerGlobal, {
    importScripts: (...paths: ImportScriptsArguments) => {
      const resolvedPaths: ImportScriptsArguments = []
      for (const path of paths) {
        if (path instanceof workerGlobal.TrustedScriptURL) {
          resolvedPaths.push(path)
        } else {
          resolvedPaths.push(resolveAbsoluteUrl(path.toString(), absoluteUrl))
        }
      }
      return origImportScripts(...resolvedPaths)
    }
  })
}

