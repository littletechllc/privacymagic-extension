/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  const connection = /** @type {Navigator & { connection?: { downlink?: number, effectiveType?: string, rtt?: number, saveData?: boolean } }} */ (navigator).connection
  if (connection == null) {
    throw new Error('navigator.connection is unavailable')
  }
  return {
    downlink: connection.downlink,
    effectiveType: connection.effectiveType,
    rtt: connection.rtt,
    saveData: connection.saveData
  }
}
