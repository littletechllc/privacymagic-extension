async function runProbe () {
  if (navigator.storage == null || typeof navigator.storage.estimate !== 'function') {
    throw new Error('navigator.storage.estimate is unavailable')
  }
  const estimate = /** @type {StorageEstimate & { usageDetails?: object }} */ (
    await navigator.storage.estimate()
  )
  return {
    usage: estimate.usage,
    quota: estimate.quota,
    usageDetails: estimate.usageDetails ?? null
  }
}
