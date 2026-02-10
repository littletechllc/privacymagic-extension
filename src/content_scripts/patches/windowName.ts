import { objectGetOwnPropertyDescriptorSafe, reflectApplySafe } from '@src/content_scripts/helpers/monkey-patch'

const windowName = (): void => {
  if (self.top !== self) {
    return
  }
  const propDescriptor = objectGetOwnPropertyDescriptorSafe(self, 'name')
  if (propDescriptor == null) {
    return
  }
  if (propDescriptor.get === undefined || propDescriptor.set === undefined) {
    return
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const nameGetter = propDescriptor.get as (this: Window) => string
  const nameGetterSafe = (window: Window): string => reflectApplySafe(nameGetter, window, [])
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const nameSetter = propDescriptor.set as (this: Window, value: string) => void
  const nameSetterSafe = (window: Window, value: string): void => reflectApplySafe(nameSetter, window, [value])
  const jsonParseSafe = JSON.parse
  const locationOrigin = self.location.origin
  const StringSafe = String
  Object.defineProperty(self, 'name', {
    get (this: Window) {
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
    set (this: Window, value: string) {
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
      // String(value) matches self.name native behavior
      data[locationOrigin] = StringSafe(value)
      nameSetterSafe(this, JSON.stringify(data))
    },
    configurable: true
  })
}

export default windowName
