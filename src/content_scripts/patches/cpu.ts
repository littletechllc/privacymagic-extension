import { redefinePropertyValues } from '../helpers'

const cpu = (): void => {
  console.log('cpu patch called')
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype == null) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    cpuClass: undefined,
    hardwareConcurrency: 4
  })
}

export default cpu
