import { redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const cpu = (globalObject: GlobalScope): void => {
  redefineNavigatorFields(globalObject, {
    cpuClass: undefined,
    hardwareConcurrency: 4
  })
}

export default cpu
