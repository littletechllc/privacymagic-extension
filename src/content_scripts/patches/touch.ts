import { redefinePropertyValues } from '../helpers'

const touch = (): (() => void) => {
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype === null || navigatorPrototype === undefined) {
    return () => {}
  }
  const restoreNavigator = redefinePropertyValues(navigatorPrototype.prototype, {
    // Cover Your Tracks: 1 in 1.74:
    maxTouchPoints: 0
  })
  return () => {
    restoreNavigator()
  }
}

export default touch
