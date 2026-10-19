importScripts('memory-probe.js')

try {
  postMessage(readDeviceMemory())
} catch (error) {
  postMessage({ error: String(error) })
}
