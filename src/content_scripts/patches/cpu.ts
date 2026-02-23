import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

const cpu = (): void => {
  const NavigatorClass = self.Navigator ?? self.WorkerNavigator
  if (NavigatorClass == null) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(NavigatorClass.prototype, {
    cpuClass: undefined,
    hardwareConcurrency: 4
  })
}

export default cpu
