/**
 * Dedicated-worker and shared-worker entry for every probe.
 * The page passes the probe script as ?src=memory-probe.js. This script
 * importScripts that file, which defines runProbe().
 * A dedicated worker also starts one nested dedicated worker and reports that
 * reading alongside its own. A nested worker is marked ?leaf=1 so it does not
 * start another worker. Shared workers cannot construct Worker.
 */

const workerLocation = new URL(self.location.href)
const probeSource = workerLocation.searchParams.get('src')
const isLeaf = workerLocation.searchParams.get('leaf') === '1'

if (probeSource == null) {
  throw new Error('probe worker missing src')
}

importScripts(probeSource)

const loadProbe = async () => {
  const runProbe = /** @type {{ runProbe?: () => Promise<unknown> }} */ (
    /** @type {unknown} */ (self)
  ).runProbe
  if (typeof runProbe !== 'function') {
    throw new Error(`runProbe() was not defined by ${probeSource}`)
  }
  return await runProbe()
}

/**
 * @param {Promise<unknown>} promise
 * @returns {Promise<unknown>}
 */
const settle = async (promise) => {
  try {
    return await promise
  } catch (error) {
    return { error: String(error) }
  }
}

const runNestedWorker = async () => {
  const nestedLocation = new URL(workerLocation.href)
  nestedLocation.searchParams.set('leaf', '1')
  /** @type {Worker} */
  let worker
  try {
    worker = new Worker(nestedLocation.href)
  } catch (error) {
    return { error: String(error) }
  }
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ error: 'nested worker timed out' })
    }, 8000)
    worker.onmessage = (/** @type {MessageEvent} */ event) => {
      clearTimeout(timer)
      resolve(event.data)
    }
    worker.onerror = (/** @type {ErrorEvent} */ event) => {
      clearTimeout(timer)
      event.preventDefault()
      resolve({ error: event.message || 'nested worker error' })
    }
  })
}

/**
 * @param {(message: unknown) => void} send
 * @param {boolean} nestWorker
 */
const deliver = async (send, nestWorker) => {
  if (!nestWorker) {
    send(await settle(loadProbe()))
    return
  }
  const reading = settle(loadProbe())
  const nestedWorker = runNestedWorker()
  send({
    reading: await reading,
    nestedWorker: await nestedWorker
  })
}

const isSharedWorker = typeof SharedWorkerGlobalScope !== 'undefined'
  && self instanceof SharedWorkerGlobalScope

if (isSharedWorker) {
  const scope = /** @type {SharedWorkerGlobalScope} */ (/** @type {unknown} */ (self))
  scope.onconnect = (/** @type {MessageEvent} */ event) => {
    const port = event.ports[0]
    if (port == null) {
      return
    }
    void deliver((message) => {
      port.postMessage(message)
    }, false)
  }
} else {
  void deliver((message) => {
    postMessage(message)
  }, !isLeaf)
}
