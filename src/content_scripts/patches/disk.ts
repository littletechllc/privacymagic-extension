import { redefinePrototypeFields } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const disk = (globalObject: GlobalScope): void => {
  if (globalObject.StorageManager == null) return
  redefinePrototypeFields(globalObject.StorageManager, {
    estimate: async () => await Promise.resolve({
      // Never report any usage
      usage: 0,
      // Report a fixed quota of 2 GB
      quota: 2147483648,
      // Never report any usage details
      usageDetails: {}
    })
  })
}

export default disk
