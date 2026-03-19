import { redefineNavigatorProperties, redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '@src/content_scripts/helpers/globalObject'

const spoofPlatforms: Record<string, string> = {
  macOS: 'MacIntel',
  Windows: 'Win32',
  Linux: 'Linux x86_64',
  Android: 'Linux armv81',
  iOS: 'iPhone'
}

const useragent = (globalObject: GlobalScope): void => {
  if (globalObject.NavigatorUAData === undefined) return
  const platform = spoofPlatforms[globalObject.navigator.userAgentData?.platform ?? 'Win32']
  redefineNavigatorProperties(globalObject, {
    platform,
  })
  const mobile = false
  redefinePropertyValues(globalObject.NavigatorUAData.prototype, {
    mobile,
    platform,
    toJSON: {
      mobile,
      platform
    },
  })
}

export default useragent
