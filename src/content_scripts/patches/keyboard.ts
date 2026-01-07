import { redefinePropertyValues } from '../helpers'

const keyboard = (): void => {
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype === null || navigatorPrototype === undefined) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    keyboard: undefined
  })
}

export default keyboard
