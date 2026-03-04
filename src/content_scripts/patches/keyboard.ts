import { redefineNavigatorProperties } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const keyboard = (globalObject: GlobalScope): void => {
  redefineNavigatorProperties(globalObject, {
    keyboard: undefined
  })
}

export default keyboard
