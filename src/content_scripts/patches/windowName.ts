import { objectGetOwnPropertyDescriptorSafe, reflectApplySafe, type MethodOf } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const windowName = (globalObject: GlobalScope): void => {
  if (globalObject.top !== globalObject) {
    return
  }
  const propDescriptor = objectGetOwnPropertyDescriptorSafe(globalObject, 'name')
  if (propDescriptor == null) {
    return
  }
  if (propDescriptor.get === undefined || propDescriptor.set === undefined) {
    return
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const nameGetter = propDescriptor.get as MethodOf<GlobalScope>
  const nameGetterSafe = (win: GlobalScope): string =>
    reflectApplySafe(nameGetter, win, [] as unknown as Parameters<MethodOf<GlobalScope>>) as string
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const nameSetter = propDescriptor.set as MethodOf<GlobalScope>
  const nameSetterSafe = (win: GlobalScope, value: string): void => {
    reflectApplySafe(nameSetter, win, [value] as unknown as Parameters<MethodOf<GlobalScope>>)
  }
  const jsonParseSafe = JSON.parse
  const locationOrigin = globalObject.location.origin
  const StringSafe = String
  Object.defineProperty(globalObject, 'name', {
    get (this: GlobalScope) {
      const nameStr = nameGetterSafe(this)
      try {
        const data = jsonParseSafe(nameStr) as unknown
        if (data == null || typeof data !== 'object' || Array.isArray(data)) {
          return ''
        }
        if (typeof (data as Record<string, string>)[locationOrigin] !== 'string') {
          return ''
        }
        return (data as Record<string, string>)[locationOrigin]
      } catch {
        return ''
      }
    },
    set (this: GlobalScope, value: string) {
      const nameStr = nameGetterSafe(this)
      let data: Record<string, string>
      try {
        const parsed = jsonParseSafe(nameStr) as unknown
        if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          data = {}
        } else {
          data = parsed as Record<string, string>
        }
      } catch {
        data = {}
      }
      if (locationOrigin === '') {
        return
      }
      // String(value) matches globalObject.name native behavior
      data[locationOrigin] = StringSafe(value)
      nameSetterSafe(this, JSON.stringify(data))
    },
    configurable: true
  })
}

export default windowName
