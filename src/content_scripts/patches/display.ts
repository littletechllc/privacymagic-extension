import { spoofMediaQuery } from '@src/content_scripts/helpers/helpers'
import { GlobalScope } from '../helpers/globalObject'

const display = (globalObject: GlobalScope): void => {
  if (globalObject.matchMedia === undefined) {
    return
  }
  spoofMediaQuery(globalObject, 'prefers-reduced-motion', 'no-preference')
}

export default display
