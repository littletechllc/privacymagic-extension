import { GlobalScope } from "../helpers/globalObject"
import { redefineFields } from "../helpers/monkey-patch"

const network = (globalObject: GlobalScope): void => {
  if (globalObject.NetworkInformation == null) {
    return
  }
  redefineFields(globalObject.NetworkInformation.prototype, {
    downlink: 100,
    downlinkMax: 100,
    effectiveType: '4g',
    rtt: 100,
    saveData: false,
    type: 'wifi'
  })
}

export default network