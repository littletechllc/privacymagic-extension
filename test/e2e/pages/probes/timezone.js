function runProbe () {
  /**
   * @param {string} name
   * @returns {string}
   */
  const resolved = (name) => new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone
  return {
    vancouver: resolved('America/Vancouver'),
    paris: resolved('Europe/Paris'),
    london: resolved('Europe/London')
  }
}
