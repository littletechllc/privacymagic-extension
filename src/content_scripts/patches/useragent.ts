import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

const useragent = (): void => {
  const originalBrands = navigator.userAgentData?.brands ?? []
  const chromiumVersion = originalBrands.find(brand => brand.brand === 'Chromium')?.version ?? '0.0.0.0'
  const platformVersion = navigator.userAgentData?.platformVersion ?? '0.0.0.0'
  const fakeChromiumVersion = `${chromiumVersion.split('.')[0]}.0.0.0`
  const fakeNotABrandVersion = '8.0.0.0'
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype == null) {
    return
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    platform: 'MacIntel',
  })
  const mobile = false
  const platform = 'MacIntel'
  redefinePropertyValues(NavigatorUAData.prototype, {
    mobile,
    platform,
    toJSON: {
      mobile,
      platform
    },
    getHighEntropyValues: () => Promise.resolve(
      {})
  })
}

export default useragent
