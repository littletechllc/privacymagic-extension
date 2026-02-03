import { redefinePropertyValues } from '@src/content_scripts/helpers/helpers'

const disk = (): void => {
  redefinePropertyValues(StorageManager.prototype, {
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
