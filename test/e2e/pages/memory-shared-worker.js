importScripts('memory-probe.js')

const scope = /** @type {SharedWorkerGlobalScope} */ (/** @type {unknown} */ (self))
scope.onconnect = (/** @type {MessageEvent} */ event) => {
  const port = event.ports[0]
  if (port == null) {
    return
  }
  try {
    port.postMessage(readDeviceMemory())
  } catch (error) {
    port.postMessage({ error: String(error) })
  }
}
