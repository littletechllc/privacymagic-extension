import { redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const keyboard = (globalObject: GlobalScope): void => {
  if (globalObject.navigator.keyboard == null) {
    return
  }
  redefineNavigatorFields(globalObject, {
    keyboard: undefined
  })
}

export default keyboard
