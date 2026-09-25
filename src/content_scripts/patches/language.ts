import { languagesForFirst } from '@src/common/languages-array'
import { redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

const language = (globalObject: GlobalScope): void => {
  const originalLanguages = Array.from(globalObject.navigator.languages)
  const languages = languagesForFirst(originalLanguages)
  redefineNavigatorFields(globalObject, {
    languages: languages.length > 0 ? languages : [globalObject.navigator.language]
  })
}

export default language
