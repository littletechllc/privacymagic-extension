import { redefineNavigatorProperties } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const cpu = (globalObject: GlobalScope): void => {
  redefineNavigatorProperties(globalObject, {
    cpuClass: undefined,
    hardwareConcurrency: 4
  })
}

export default cpu
