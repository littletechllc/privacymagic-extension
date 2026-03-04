import { redefineNavigatorProperties } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const touch = (globalObject: GlobalScope): void => {
  redefineNavigatorProperties(globalObject, {
    // Cover Your Tracks: 1 in 1.74:
    maxTouchPoints: 0
  })
}

export default touch
