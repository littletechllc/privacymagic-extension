import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

const keyboard = (): void => {
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype == null) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    keyboard: undefined
  })
}

export default keyboard
