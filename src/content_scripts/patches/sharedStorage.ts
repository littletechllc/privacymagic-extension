import { GlobalScope } from '../helpers/globalObject'

const sharedStorage = (globalObject: GlobalScope): void => {
  if (globalObject.SharedStorage != null) {
    delete globalObject.SharedStorage
  }
  if (globalObject.sharedStorage != null) {
    delete globalObject.sharedStorage
  }
}

export default sharedStorage
