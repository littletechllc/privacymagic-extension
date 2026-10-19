/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

async function runProbe () {
  if (navigator.serviceWorker == null) {
    throw new Error('navigator.serviceWorker is unavailable')
  }
  try {
    await navigator.serviceWorker.register('probes/service-worker-probe.js')
    return { name: null, message: null }
  } catch (error) {
    const exception = /** @type {{ name?: string, message?: string }} */ (error)
    return {
      name: exception.name ?? null,
      message: exception.message ?? null
    }
  }
}
