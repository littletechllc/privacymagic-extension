/** True when this extension page is running in Microsoft Edge (Chromium). */
export const isEdgeBrowser = (): boolean => {
  const brands = navigator.userAgentData?.brands
  if (brands != null && brands.length > 0) {
    return brands.some((brand) => brand.brand === 'Microsoft Edge')
  }
  return /\bEdg\//.test(navigator.userAgent)
}
