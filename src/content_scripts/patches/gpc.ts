import { redefineNavigatorFields } from '@src/content_scripts/helpers/monkey-patch'
import type { GlobalScope } from '../helpers/globalObject'

// Global Privacy Control is a signal that allows users to opt out of websites
// selling or sharing their personal information with third parties.
// https://globalprivacycontrol.org/
const gpc = (globalObject: GlobalScope): void => {
  redefineNavigatorFields(globalObject, {
    globalPrivacyControl: true
  })
}

export default gpc
