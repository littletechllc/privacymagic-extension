/**
 * Runs runProbe() from the surrounding probe page in the page, a dedicated worker,
 * and a shared worker. Both workers load this same script.
 */
const resultElement = document.getElementById('probe-result')
if (resultElement == null) {
  throw new Error('probe page is missing #probe-result')
}
const result = resultElement

/** @type {Record<string, unknown>} */
const readings = {}
const pending = new Set(['page', 'worker', 'sharedWorker'])

const finishIfReady = () => {
  if (pending.size > 0) {
    return
  }
  result.dataset.status = 'done'
  result.textContent = JSON.stringify(readings, null, 2)
}

/**
 * @param {string} key
 * @param {unknown} value
 */
const record = (key, value) => {
  if (!pending.has(key)) {
    return
  }
  readings[key] = value
  pending.delete(key)
  finishIfReady()
}

setTimeout(() => {
  for (const key of ['page', 'worker', 'sharedWorker']) {
    record(key, { error: 'timed out' })
  }
}, 10000)

const runPageProbe = async () => {
  const runProbe = /** @type {{ runProbe?: () => Promise<unknown> }} */ (
    /** @type {unknown} */ (globalThis)
  ).runProbe
  if (typeof runProbe !== 'function') {
    throw new Error('runProbe() was not defined')
  }
  return await runProbe()
}

/**
 * @param {unknown} error
 */
const recordProbeError = (error) => {
  record('page', { error: String(error) })
}

void runPageProbe().then(
  (reading) => {
    record('page', reading)
  },
  recordProbeError
)

const workerUrl = `probe-worker.js?src=${encodeURIComponent(location.pathname)}`

const worker = new Worker(workerUrl)
worker.onmessage = (/** @type {MessageEvent} */ event) => {
  record('worker', event.data)
}
worker.onerror = (/** @type {ErrorEvent} */ event) => {
  record('worker', { error: event.message || 'worker error' })
}

const sharedWorker = new SharedWorker(workerUrl)
sharedWorker.port.onmessage = (/** @type {MessageEvent} */ event) => {
  record('sharedWorker', event.data)
}
sharedWorker.onerror = (/** @type {ErrorEvent} */ event) => {
  record('sharedWorker', { error: event.message || 'shared worker error' })
}
