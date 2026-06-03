import { GlobalScope } from '../helpers/globalObject'

const sharedStorage = (globalObject: GlobalScope): void => {
  if (globalObject.sharedStorage != null) {
    delete globalObject.sharedStorage
  }
  if (globalObject.SharedStorage != null) {
    delete globalObject.SharedStorage
  }
  if (globalObject.SharedStorageAppendMethod != null) {
    delete globalObject.SharedStorageAppendMethod
  }
  if (globalObject.SharedStorageClearMethod != null) {
    delete globalObject.SharedStorageClearMethod
  }
  if (globalObject.SharedStorageDeleteMethod != null) {
    delete globalObject.SharedStorageDeleteMethod
  }
  if (globalObject.SharedStorageModifierMethod != null) {
    delete globalObject.SharedStorageModifierMethod
  }
  if (globalObject.SharedStorageSetMethod != null) {
    delete globalObject.SharedStorageSetMethod
  }
  if (globalObject.SharedStorageWorklet != null) {
    delete globalObject.SharedStorageWorklet
  }
}

export default sharedStorage
