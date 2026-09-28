import { redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const cpu = (globalObject: GlobalScope): void => {
  const byte = new Uint8Array(1)
  globalObject.crypto.getRandomValues(byte)
  const hardwareConcurrency = 4 + (byte[0] % 5)
  redefineNavigatorFields(globalObject, {
    hardwareConcurrency
  })
}

export default cpu
