async function runProbe () {
  const ua = navigator.userAgentData
  if (ua == null) {
    throw new Error('navigator.userAgentData is unavailable')
  }
  const hints = await ua.getHighEntropyValues(['fullVersionList', 'uaFullVersion'])
  const fullVersionList = /** @type {Array<{ version?: string }> | undefined} */ (hints.fullVersionList)
  const uaFullVersion = /** @type {string | undefined} */ (hints.uaFullVersion)
  /**
   * @param {string} version
   * @returns {boolean}
   */
  const reduced = (version) => /^\d+(?:\.0)+$/.test(version)
  return {
    platform: navigator.platform,
    uaPlatform: ua.platform,
    mobile: ua.mobile,
    json: ua.toJSON(),
    fullVersionsReduced: Array.isArray(fullVersionList)
      && fullVersionList.length > 0
      && fullVersionList.every((brand) => typeof brand.version === 'string' && reduced(brand.version)),
    uaFullVersionReduced: typeof uaFullVersion === 'string' && reduced(uaFullVersion)
  }
}
