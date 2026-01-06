import { redefinePropertyValues } from '../helpers'

const language = () => {
  const originalLanguage = navigator.language
  const navigatorPrototype = self.Navigator || self.WorkerNavigator
  return redefinePropertyValues(navigatorPrototype.prototype, {
    // Reduce to a single language to reduce entropy.
    languages: [originalLanguage]
  })
}

export default language
