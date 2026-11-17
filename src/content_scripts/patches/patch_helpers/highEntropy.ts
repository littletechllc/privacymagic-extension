import { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { createSafeMethod, redefineMethods } from '@src/content_scripts/helpers/monkey-patch'
import { ContentSettingId } from '@src/common/setting-ids'
import { arrayIncludesSafe, objectKeysSafe } from '@src/content_scripts/helpers/safe'

const sanitizeGetHighEntropyValues = (globalObject: GlobalScope, disabledSettings: (Exclude<ContentSettingId, 'masterSwitch'>)[]): void => {
  if (globalObject.NavigatorUAData === undefined) {
    return
  }
  const getHighEntropyValuesSafe = createSafeMethod(globalObject.NavigatorUAData, 'getHighEntropyValues')
  const settingForHint: Record<HighEntropyHint, Exclude<ContentSettingId, 'masterSwitch'> | undefined> = {
    architecture: 'cpu',
    bitness: 'cpu',
    brands: undefined,
    formFactors: 'device',
    fullVersionList: 'useragent',
    mobile: undefined,
    model: 'device',
    platform: undefined,
    platformVersion: 'device',
    uaFullVersion: 'useragent',
    wow64: 'device',
  }
  redefineMethods(globalObject.NavigatorUAData.prototype, {
    // This might throw an error if the hints are not permitted by the user;
    // we let the error bubble up to the caller.
    getHighEntropyValues: async function (this: NavigatorUAData, hints: HighEntropyHint[]): Promise<HighEntropyValues> {
      const result: HighEntropyValues = await getHighEntropyValuesSafe(this, hints)
      for (const hint of objectKeysSafe(result) as HighEntropyHint[]) {
        const setting = settingForHint[hint]
        if (setting != null && !arrayIncludesSafe(disabledSettings, setting)) {
          delete result[hint]
        }
      }
      return result
    }
  })
}

export default sanitizeGetHighEntropyValues