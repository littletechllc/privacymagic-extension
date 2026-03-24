import { redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const memory = (globalObject: GlobalScope): void => {
  redefineNavigatorFields(globalObject, {
    // Cover Your Tracks: 1 in 1.93 browsers have this value:
    deviceMemory: undefined
  })
}

export default memory
