import { redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'

// Global Privacy Control is a signal that allows users to opt out of websites
// selling or sharing their personal information with third parties.
// https://globalprivacycontrol.org/
const gpc = (): void => {
  const navigatorPrototype = self.Navigator ?? self.WorkerNavigator
  if (navigatorPrototype == null) {
    throw new Error('Navigator prototype not found')
  }
  redefinePropertyValues(navigatorPrototype.prototype, {
    globalPrivacyControl: true
  })
}

export default gpc
