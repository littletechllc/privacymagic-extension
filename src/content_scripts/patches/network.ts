import { GlobalScope } from "../helpers/globalObject"
import { redefinePrototypeFields } from "../helpers/monkey-patch"

const network = (globalObject: GlobalScope): void => {
  if (globalObject.NetworkInformation == null) {
    return
  }
  redefinePrototypeFields(globalObject.NetworkInformation, {
    downlink: 100,
    effectiveType: '4g',
    rtt: 100,
    saveData: false
  })
}

export default network