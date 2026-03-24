import { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { createSafeMethod, redefineMethods } from '@src/content_scripts/helpers/monkey-patch'
import { ContentSettingId } from '@src/common/setting-ids'

const sanitizeGetHighEntropyValues = (globalObject: GlobalScope, disabledSettings: (Exclude<ContentSettingId, 'masterSwitch'>)[]): void => {
  if (globalObject.NavigatorUAData === undefined) return
  const getHighEntropyValuesSafe = createSafeMethod(globalObject.NavigatorUAData, 'getHighEntropyValues')
  const settingForHint: Record<HighEntropyHint, Exclude<ContentSettingId, 'masterSwitch'> | undefined> = {
    architecture: 'cpu',
    bitness: 'cpu',
    brands: undefined,
    formFactors: 'device',
    fullVersionList: 'useragent',
    mobile: 'device',
    model: 'device',
    platform: undefined,
    platformVersion: 'device',
    uaFullVersion: 'useragent',
    wow64: 'device',
  }
  const spoofVersion = (version: string): string => {
    return version.replaceAll(/\.\d+/g, '.0')
  }
  const platform = globalObject.navigator.platform === 'Win32' ? 'Windows' : globalObject.navigator.platform
  redefineMethods(globalObject.NavigatorUAData.prototype, {
    // This might throw an error if the hints are not permitted by the user;
    // we let the error bubble up to the caller.
    getHighEntropyValues: async function (this: NavigatorUAData, hints: HighEntropyHint[]): Promise<HighEntropyValues> {
      const result: HighEntropyValues = await getHighEntropyValuesSafe(this, hints)
      for (const hint of hints) {
        const setting = settingForHint[hint]
        const originalValue = result[hint]
        const shouldSpoof = setting != null && !disabledSettings.includes(setting)
        if (shouldSpoof) {
          switch (hint) {
            case 'architecture':
              result[hint] = 'x86'
              break
            case 'bitness':
              result[hint] = '64'
              break
            case 'brands':
              const brandVersionArray = originalValue as Array<{ brand: string, version: string }>
              result[hint] = brandVersionArray.map(brand => ({ brand: brand.brand, version: spoofVersion(brand.version) }))
              break
            case 'formFactors':
              result[hint] = ['Desktop']
              break
            case 'fullVersionList':
              const fullVersionListArray = originalValue as Array<{ brand: string, version: string }>
              result[hint] = fullVersionListArray.map(brand => ({ brand: brand.brand, version: spoofVersion(brand.version) }))
              break
            case 'mobile':
              result[hint] = false
              break
            case 'model':
              result[hint] = ''
              break
            case 'platform':
              result[hint] = platform
              break
            case 'platformVersion':
              result[hint] = spoofVersion(typeof originalValue === 'string' ? originalValue : '')
              break
            case 'uaFullVersion':
              result[hint] = spoofVersion(typeof originalValue === 'string' ? originalValue : '')
              break
            case 'wow64':
              result[hint] = false
              break
          }
        }
      }
      return result
    }
  })
}

export default sanitizeGetHighEntropyValues