import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import windowName from '@src/content_scripts/patches/windowName'

describe('windowName patch', () => {
  let backingStore: string
  let originalNameDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    backingStore = ''
    originalNameDescriptor = Object.getOwnPropertyDescriptor(self, 'name')
    Object.defineProperty(self, 'name', {
      get: () => backingStore,
      set: (v: string) => {
        backingStore = String(v)
      },
      configurable: true,
      enumerable: true
    })
  })

  afterEach(() => {
    if (originalNameDescriptor !== undefined) {
      Object.defineProperty(self, 'name', originalNameDescriptor)
    } else {
      delete (self as unknown as Record<string, unknown>).name
    }
  })

  describe('without patch', () => {
    it('should expose whatever is stored in window.name', () => {
      backingStore = 'leaky-value'
      expect(self.name).toBe('leaky-value')
    })

    it('should allow setting window.name', () => {
      self.name = 'custom'
      expect(backingStore).toBe('custom')
    })
  })

  describe('with patch enabled', () => {
    const origin = self.location.origin

    beforeEach(() => {
      windowName()
    })

    it('get: should return empty string when name is empty', () => {
      backingStore = ''
      expect(self.name).toBe('')
    })

    it('get: should return empty string when name is not valid JSON', () => {
      backingStore = 'not-json'
      expect(self.name).toBe('')
    })

    it('get: should return empty string when name is JSON but not an object', () => {
      backingStore = '"string"'
      expect(self.name).toBe('')
    })

    it('get: should return empty string when name is JSON null', () => {
      backingStore = 'null'
      expect(self.name).toBe('')
    })

    it('get: should return empty string when name is JSON array', () => {
      backingStore = '[]'
      expect(self.name).toBe('')
    })

    it('get: should return value for current origin when name is JSON object', () => {
      backingStore = JSON.stringify({ [origin]: 'my-origin-value', 'https://other.com': 'other' })
      expect(self.name).toBe('my-origin-value')
    })

    it('get: should return empty string when current origin key is missing', () => {
      backingStore = JSON.stringify({ 'https://other.com': 'other' })
      expect(self.name).toBe('')
    })

    it('set: should store value keyed by current origin', () => {
      self.name = 'my-value'
      const data = JSON.parse(backingStore) as Record<string, string>
      expect(data[origin]).toBe('my-value')
    })

    it('set: should preserve other origins when setting', () => {
      backingStore = JSON.stringify({ 'https://other.com': 'other-value' })
      self.name = 'local-value'
      const data = JSON.parse(backingStore) as Record<string, string>
      expect(data[origin]).toBe('local-value')
      expect(data['https://other.com']).toBe('other-value')
    })

    it('set then get: should roundtrip', () => {
      self.name = 'roundtrip-value'
      expect(self.name).toBe('roundtrip-value')
    })

    it('set: should coerce value to string', () => {
      self.name = 123 as unknown as string
      expect(self.name).toBe('123')
    })

    it('set: should overwrite when previous value was JSON null', () => {
      backingStore = 'null'
      self.name = 'after-null'
      expect(self.name).toBe('after-null')
    })

    it('set: should overwrite when previous value was JSON array', () => {
      backingStore = '[]'
      self.name = 'after-array'
      expect(self.name).toBe('after-array')
    })
  })
})
