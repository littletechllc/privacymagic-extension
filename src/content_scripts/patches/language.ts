import { redefinePropertyValues } from '../helpers'

const language = (): void => {
  const originalLanguage = navigator.language
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype == null) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    // Reduce to a single language to reduce entropy.
    languages: [originalLanguage]
  })
}

export default language
