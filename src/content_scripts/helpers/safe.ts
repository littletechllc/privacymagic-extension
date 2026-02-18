
import { createSafeMethod } from "./monkey-patch"

export const reflectConstructSafe = Reflect.construct

export const weakMapGetSafe = createSafeMethod(WeakMap, 'get')
export const weakMapHasSafe = createSafeMethod(WeakMap, 'has')
export const weakMapSetSafe = createSafeMethod(WeakMap, 'set')

export const weakSetHasSafe = createSafeMethod(WeakSet, 'has')
export const weakSetAddSafe = createSafeMethod(WeakSet, 'add')

export const dispatchEventSafe = self.Document !== undefined ? createSafeMethod(self.Document, 'dispatchEvent') : undefined

export const stringTrimSafe = createSafeMethod(String, 'trim')

export const documentSafe = self.document !== undefined ? self.document : undefined
export const CustomEventSafe = self.CustomEvent !== undefined ? self.CustomEvent : undefined
