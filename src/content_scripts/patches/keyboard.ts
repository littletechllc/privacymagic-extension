import { redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const keyboard = (globalObject: GlobalScope): void => {
  redefineNavigatorFields(globalObject, {
    keyboard: undefined
  })
}

export default keyboard
