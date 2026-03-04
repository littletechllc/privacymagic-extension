import { createSafeMethod, redefineNavigatorProperties, redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const roundVersion = (originalVersionString: string): string => {
  try {
    const originalParts = originalVersionString.split('.')
    const newParts: string[] = []
    newParts.push(originalParts[0])
    for (let i = 1; i < originalParts.length; ++i) {
        newParts.push('0')
    }
    return newParts.join('.')
  } catch {
    return '0.0.0.0'
  }
}

const spoofPlatforms: Record<string, string> = {
  macOS: 'MacIntel',
  Windows: 'Win32',
  Linux: 'Linux x86_64',
  Android: 'Linux armv81',
  iOS: 'iPhone'
}

const useragent = (globalObject: GlobalScope): void => {
  if (globalObject.NavigatorUAData === undefined) return
  const getHighEntropyValuesSafe = createSafeMethod(globalObject.NavigatorUAData, 'getHighEntropyValues')
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
    getHighEntropyValues: async function (this: NavigatorUAData, hints: HighEntropyHint[]): Promise<HighEntropyValues> {
      const result = await getHighEntropyValuesSafe(this, hints)
      result.mobile = this.mobile
      result.platform = this.platform
      result.brands = this.brands
      if (result.architecture != null) {
        result.architecture = 'x86'
      }
      if (result.bitness != null) {
        result.bitness = '64'
      }
      if (result.formFactors != null) {
        result.formFactors = ['Desktop']
      }
      if (result.fullVersionList != null) {
        // TODO: Use a common unrounded browser version
        result.fullVersionList = result.fullVersionList.map(
          ({ brand, version }: { brand: string, version: string }) => ({ brand, version: roundVersion(version) }))
      }
      if (result.mobile != null) {
        result.mobile = false
      }
      if (result.model != null) {
        result.model = ''
      }
      if (result.platformVersion != null) {
        if (this.platform === 'Windows') {
          result.platformVersion = '10.0.0'
        } else {
          // TODO: Get common platform versions
          result.platformVersion = roundVersion(result.platformVersion)
        }
      }
      if (result.uaFullVersion != null) {
        result.uaFullVersion = roundVersion(result.uaFullVersion)
      }
      if (result.wow64 != null) {
        result.wow64 = false
      }
      return result
    }
  })
}

export default useragent
