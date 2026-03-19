import { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { createSafeMethod, redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'
import { ContentSettingId } from '@src/common/setting-ids'

const sanitizeGetHighEntropyValues = (globalObject: GlobalScope, disabledSettings: (Exclude<ContentSettingId, 'masterSwitch'>)[]): void => {
  if (globalObject.NavigatorUAData === undefined) return
  const getHighEntropyValuesSafe = createSafeMethod(globalObject.NavigatorUAData, 'getHighEntropyValues')
  const throwNotAllowedError = (message: string) => {
    throw new globalObject.DOMException(message, 'NotAllowedError')
  }
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
  redefinePropertyValues(globalObject.NavigatorUAData.prototype, {
    getHighEntropyValues: async function (this: NavigatorUAData, hints: HighEntropyHint[]): Promise<HighEntropyValues> {
      for (const hint of hints) {
        const setting = settingForHint[hint]
        if (setting != null && !disabledSettings.includes(setting)) {
          throwNotAllowedError('Not allowed')
        }
      }
      return getHighEntropyValuesSafe(this, hints)
    }
  })
}

export default sanitizeGetHighEntropyValues