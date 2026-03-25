import { redefinePrototypeFields, redefineMethods, redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
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
  redefineNavigatorFields(globalObject, {
    platform,
  })
  const mobile = false
  redefinePrototypeFields(globalObject.NavigatorUAData, {
    mobile,
    platform,
  })
  redefineMethods(globalObject.NavigatorUAData.prototype, {
    toJSON: function (this: NavigatorUAData) {
      return {
        mobile,
        platform
      }
    }
  })
}

export default useragent
