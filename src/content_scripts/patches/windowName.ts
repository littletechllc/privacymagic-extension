import { objectGetOwnPropertyDescriptorSafe, reflectApplySafe } from '../helpers'

const windowName = (): void => {
  if (self.top !== self) {
    return
  }
  const propDescriptor = objectGetOwnPropertyDescriptorSafe(self, 'name')
  if (propDescriptor === null || propDescriptor === undefined) {
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
        const data: Record<string, string> = jsonParseSafe(nameStr) as Record<string, string>
        if (typeof data !== 'object') {
          return ''
        }
        if (typeof data[locationOrigin] !== 'string') {
          return ''
        }
        return data[locationOrigin]
      } catch {
        return ''
      }
    },
    set (this: Window, value: string) {
      const nameStr = nameGetterSafe(this)
      let data: Record<string, string>
      try {
        data = jsonParseSafe(nameStr) as Record<string, string>
        if (typeof data !== 'object') {
          data = {}
        }
      } catch {
        data = {}
      }
      if (locationOrigin === '' || locationOrigin.length === 0) {
        return
      }
      // String(value) matches self.name native behavior
      data[locationOrigin] = StringSafe(value)
      nameSetterSafe(this, JSON.stringify(data))
    },
    configurable: true
  })
  console.log('self.name patched')
}

export default windowName
