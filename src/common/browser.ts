const BROWSER_OWNERS = {
  Chrome: 'Google',
  Edge: 'Microsoft',
  Firefox: 'Mozilla',
  Opera: 'Opera',
  Brave: 'Brave',
  Vivaldi: 'Vivaldi',
  Safari: 'Apple'
} as const

type BrowserBrand = keyof typeof BROWSER_OWNERS

type BrowserInfoFor<Brand extends BrowserBrand> = {
  brand: Brand
  owner: (typeof BROWSER_OWNERS)[Brand]
}

export type BrowserInfo = { [Brand in BrowserBrand]: BrowserInfoFor<Brand> }[BrowserBrand]

const browserInfoFor = <Brand extends BrowserBrand>(brand: Brand): BrowserInfoFor<Brand> => ({
  brand,
  owner: BROWSER_OWNERS[brand]
})

const brands = navigator.userAgentData?.brands?.map((entry) => entry.brand) ?? []
const userAgent = navigator.userAgent
const brandsAbsent = brands.length === 0

/** Brave omits its name from the user agent, so `navigator.brave` is the stable signal. */
const isBrave = brands.includes('Brave') || 'brave' in navigator

const candidates: Array<[boolean, BrowserInfo]> = [
  [brands.includes('Firefox') || /\bFirefox\//.test(userAgent), browserInfoFor('Firefox')],
  [brands.includes('Microsoft Edge') || (brandsAbsent && /\bEdg\//.test(userAgent)), browserInfoFor('Edge')],
  [brands.includes('Opera') || (brandsAbsent && /\bOPR\//.test(userAgent)), browserInfoFor('Opera')],
  [isBrave, browserInfoFor('Brave')],
  [brands.includes('Vivaldi') || (brandsAbsent && /\bVivaldi\//.test(userAgent)), browserInfoFor('Vivaldi')],
  [brands.includes('Safari') || (brandsAbsent && /\bSafari\//.test(userAgent) && !/\bChrome\//.test(userAgent)), browserInfoFor('Safari')]
]

/** Unrecognized clients use Chrome/Google. */
export const browserInfo: BrowserInfo = candidates.find(([matches]) => matches)?.[1] ?? browserInfoFor('Chrome')
