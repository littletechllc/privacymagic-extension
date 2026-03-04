import { GlobalScope } from '../helpers/globalObject'

const sharedStorage = (globalObject: GlobalScope): void => {
  if (globalObject.SharedStorage == null) {
    return
  }
  delete globalObject.SharedStorage
}

export default sharedStorage
