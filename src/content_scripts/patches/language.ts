import { redefineNavigatorProperties } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const language = (globalObject: GlobalScope): void => {
  const originalLanguage = globalObject.navigator.language
  redefineNavigatorProperties(globalObject, {
    // Reduce to a single language to reduce entropy.
    languages: [originalLanguage]
  })
}

export default language
