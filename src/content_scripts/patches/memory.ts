import { redefinePropertyValues } from '@src/content_scripts/helpers/helpers'

const memory = (): void => {
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype == null) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    // Cover Your Tracks: 1 in 1.93 browsers have this value:
    deviceMemory: undefined
  })
}

export default memory
