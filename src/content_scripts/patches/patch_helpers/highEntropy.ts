import { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { createSafeMethod, redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'
import { ContentSettingId } from '@src/common/setting-ids'

const sanitizeGetHighEntropyValues = (globalObject: GlobalScope, disabledSettings: (Exclude<ContentSettingId, 'masterSwitch'>)[]): void => {
  if (globalObject.NavigatorUAData === undefined) return
  const getHighEntropyValuesSafe = createSafeMethod(globalObject.NavigatorUAData, 'getHighEntropyValues')
  const throwNotAllowedError = (message: string) => {
    throw new globalObject.DOMException(message, 'NotAllowedError')
  }
  const hintControlMap: Partial<Record<ContentSettingId, HighEntropyHint[]>> = {
    cpu: ['architecture', 'bitness'],
    device: ['formFactors', 'mobile', 'model', 'platformVersion', 'wow64'],
    useragent: ['brands', 'fullVersionList', 'uaFullVersion'],
  }
  redefinePropertyValues(globalObject.NavigatorUAData.prototype, {
    getHighEntropyValues: async function (this: NavigatorUAData, hints: HighEntropyHint[]): Promise<HighEntropyValues> {
      const allowedHints = new Set<HighEntropyHint>()
      for (const disabledSetting of disabledSettings) {
        const allowedHintsForSetting = hintControlMap[disabledSetting]
        if (allowedHintsForSetting != null) {
          allowedHintsForSetting.forEach(hint => allowedHints.add(hint))
        }
      }
      for (const hint of hints) {
        if (!allowedHints.has(hint)) {
          throwNotAllowedError('Not allowed')
        }
      }
      return getHighEntropyValuesSafe(this, hints)
    }
  })
}

export default sanitizeGetHighEntropyValues