/** True when this extension page is running in Microsoft Edge (Chromium). */
export const isEdgeBrowser = (): boolean => {
  const brands = navigator.userAgentData?.brands
  if (brands != null && brands.length > 0) {
    return brands.some((brand) => brand.brand === 'Microsoft Edge')
  }
  return /\bEdg\//.test(navigator.userAgent)
}

/** True when this extension page is running in Firefox. */
export const isFirefoxBrowser = (): boolean => {
  if (/\bFirefox\//.test(navigator.userAgent)) {
    return true
  }
  const brands = navigator.userAgentData?.brands
  return brands?.some((brand) => brand.brand === 'Firefox') ?? false
}
