/**
 * Dedicated-worker and shared-worker entry for every probe page.
 * The page passes the probe document as ?src=/disk-probe.html. This script
 * fetches that document and evaluates its inline scripts, which define runProbe().
 */

const probeSource = new URL(self.location.href).searchParams.get('src')

/**
 * @param {string} html
 * @returns {string[]}
 */
const inlineScripts = (html) => {
  /** @type {string[]} */
  const scripts = []
  const pattern = /<script>([\s\S]*?)<\/script>/g
  for (const match of html.matchAll(pattern)) {
    scripts.push(match[1] ?? '')
  }
  return scripts
}

const loadProbe = async () => {
  if (probeSource == null || probeSource === '') {
    throw new Error('probe worker missing src')
  }
  const response = await fetch(probeSource)
  const html = await response.text()
  const scripts = inlineScripts(html)
  if (scripts.length === 0) {
    throw new Error(`no inline script in ${probeSource}`)
  }
  for (const script of scripts) {
    const evaluate = eval
    evaluate(script)
  }
  const runProbe = /** @type {{ runProbe?: () => Promise<unknown> }} */ (
    /** @type {unknown} */ (self)
  ).runProbe
  if (typeof runProbe !== 'function') {
    throw new Error(`runProbe() was not defined by ${probeSource}`)
  }
  return await runProbe()
}

/**
 * @param {(message: unknown) => void} send
 */
const deliver = async (send) => {
  try {
    send(await loadProbe())
  } catch (error) {
    send({ error: String(error) })
  }
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
    })
  }
} else {
  void deliver((message) => {
    postMessage(message)
  })
}
