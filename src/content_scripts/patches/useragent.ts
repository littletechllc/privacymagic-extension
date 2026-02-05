import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

const useragent = (): void => {
  const originalBrands = navigator.userAgentData?.brands ?? []
  const chromiumVersion = originalBrands.find(brand => brand.brand === 'Chromium')?.version ?? '0.0.0.0'
  const uaData = navigator.userAgentData as { platformVersion?: string } | undefined
  const _platformVersion: string = uaData?.platformVersion ?? '0.0.0.0'
  const _fakeChromiumVersion = `${chromiumVersion.split('.')[0]}.0.0.0`
  const _fakeNotABrandVersion = '8.0.0.0'
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
