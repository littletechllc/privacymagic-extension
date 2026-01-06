import { redefinePropertyValues } from '../helpers'

const keyboard = (): (() => void) => {
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype === null || navigatorPrototype === undefined) {
    return () => {}
  }
  return redefinePropertyValues(navigatorPrototype.prototype, {
    keyboard: undefined
  })
}

export default keyboard
