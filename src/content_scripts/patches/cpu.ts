import { redefinePropertyValues } from '../helpers'

const cpu = (): void => {
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype === null || navigatorPrototype === undefined) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    cpuClass: undefined,
    hardwareConcurrency: 4
  })
}

export default cpu
