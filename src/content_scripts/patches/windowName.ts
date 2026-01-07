import { objectDefinePropertiesSafe } from '../helpers'

const windowName = (): void => {
  if (self.top !== self) {
    return
  }
  const propDescriptor = Object.getOwnPropertyDescriptor(self, 'name')
  if (propDescriptor == null) {
    return
  }
  if (propDescriptor.get === undefined || propDescriptor.set === undefined) {
    return
  }
  const nameGetter = propDescriptor.get
  const nameSetter = propDescriptor.set
  Object.defineProperty(self, 'name', {
    get () {
      const nameStr = nameGetter.call(this)
      try {
        const data = JSON.parse(nameStr)
        if (typeof data !== 'object' || data === null) {
          return ''
        }
        const origin = self.location.origin
        if (typeof data[origin] !== 'string') {
          return ''
        }
        return data[origin]
      } catch (error) {
        return ''
      }
    },
    set (value) {
      const nameStr = nameGetter.call(this)
      let data
      try {
        data = JSON.parse(nameStr)
        if (typeof data !== 'object' || data === null) {
          data = {}
        }
      } catch (error) {
        data = {}
      }
      const origin = self.location.origin
      if (origin === '' || origin.length === 0) {
        return
      }
      // String(value) matches self.name native behavior
      data[origin] = String(value)
      nameSetter.call(this, JSON.stringify(data))
    },
    configurable: true
  })
  console.log('self.name patched')
}

export default windowName
