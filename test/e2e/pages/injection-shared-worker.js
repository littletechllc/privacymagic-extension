const scope = /** @type {SharedWorkerGlobalScope} */ (/** @type {unknown} */ (self))
scope.onconnect = (/** @type {MessageEvent} */ event) => {
  const port = event.ports[0]
  if (port == null) {
    return
  }
  port.postMessage(navigator.hardwareConcurrency)
}
