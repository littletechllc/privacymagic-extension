import { redefinePropertyValues } from '../helpers'

const cpu = () => {
  const navigatorPrototype = self.Navigator || self.WorkerNavigator
  return redefinePropertyValues(navigatorPrototype.prototype, {
    cpuClass: undefined,
    hardwareConcurrency: 4
  })
}

export default cpu
