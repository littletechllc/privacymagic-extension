import { describe, it, expect } from '@jest/globals'
import { includeInListIfNeeded, objectEntries } from '@src/common/data-structures'

describe('includeInListIfNeeded', () => {
  describe('when include is true', () => {
    it('should add item to undefined array', () => {
      const result = includeInListIfNeeded(undefined, 'item', true)
      expect(result).toEqual(['item'])
    })

    it('should add item to empty array', () => {
      const result = includeInListIfNeeded([], 'item', true)
      expect(result).toEqual(['item'])
    })

    it('should add item to existing array', () => {
      const result = includeInListIfNeeded(['a', 'b'], 'c', true)
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should not add duplicate item', () => {
      const result = includeInListIfNeeded(['a', 'b'], 'a', true)
      expect(result).toEqual(['a', 'b'])
    })

    it('should work with numbers', () => {
      const result = includeInListIfNeeded([1, 2], 3, true)
      expect(result).toEqual([1, 2, 3])
    })

    it('should work with objects', () => {
      const obj1 = { id: 1 }
      const obj2 = { id: 2 }
      const obj3 = { id: 3 }
      const result = includeInListIfNeeded([obj1, obj2], obj3, true)
      expect(result).toEqual([obj1, obj2, obj3])
    })
  })

  describe('when include is false', () => {
    it('should return undefined when array is undefined', () => {
      const result = includeInListIfNeeded(undefined, 'item', false)
      expect(result).toBeUndefined()
    })

    it('should return undefined when removing last item', () => {
      const result = includeInListIfNeeded(['item'], 'item', false)
      expect(result).toBeUndefined()
    })

    it('should remove item from array', () => {
      const result = includeInListIfNeeded(['a', 'b', 'c'], 'b', false)
      expect(result).toEqual(['a', 'c'])
    })

    it('should not modify array when item is not present', () => {
      const result = includeInListIfNeeded(['a', 'b'], 'c', false)
      expect(result).toEqual(['a', 'b'])
    })

    it('should work with numbers', () => {
      const result = includeInListIfNeeded([1, 2, 3], 2, false)
      expect(result).toEqual([1, 3])
    })

    it('should work with objects', () => {
      const obj1 = { id: 1 }
      const obj2 = { id: 2 }
      const obj3 = { id: 3 }
      const result = includeInListIfNeeded([obj1, obj2, obj3], obj2, false)
      expect(result).toEqual([obj1, obj3])
    })

    it('should remove first item', () => {
      const result = includeInListIfNeeded(['a', 'b', 'c'], 'a', false)
      expect(result).toEqual(['b', 'c'])
    })

    it('should remove last item', () => {
      const result = includeInListIfNeeded(['a', 'b', 'c'], 'c', false)
      expect(result).toEqual(['a', 'b'])
    })
  })
})

describe('objectEntries', () => {
  it('should return entries for simple object', () => {
    const obj = { a: 1, b: 2, c: 3 } as const
    const result = objectEntries(obj)
    expect(result).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ])
  })

  it('should return entries for empty object', () => {
    const obj = {} as Record<string, never>
    const result = objectEntries(obj)
    expect(result).toEqual([])
  })

  it('should return entries with string values', () => {
    const obj = { name: 'test', type: 'example' } as const
    const result = objectEntries(obj)
    expect(result).toEqual([
      ['name', 'test'],
      ['type', 'example']
    ])
  })

  it('should return entries with boolean values', () => {
    const obj = { enabled: true, disabled: false } as const
    const result = objectEntries(obj)
    expect(result).toEqual([
      ['enabled', true],
      ['disabled', false]
    ])
  })

  it('should return entries with array values', () => {
    const obj = { items: [1, 2, 3], tags: ['a', 'b'] } as const
    const result = objectEntries(obj)
    expect(result).toEqual([
      ['items', [1, 2, 3]],
      ['tags', ['a', 'b']]
    ])
  })

  it('should return entries with object values', () => {
    const obj = {
      config: { setting: 'value' },
      meta: { version: 1 }
    } as const
    const result = objectEntries(obj)
    expect(result).toEqual([
      ['config', { setting: 'value' }],
      ['meta', { version: 1 }]
    ])
  })

  it('should preserve key types', () => {
    type Keys = 'key1' | 'key2' | 'key3'
    const obj: Record<Keys, number> = { key1: 1, key2: 2, key3: 3 }
    const result = objectEntries(obj)
    expect(result[0][0]).toBe('key1')
    expect(result[0][1]).toBe(1)
  })

  it('should work with single property object', () => {
    const obj = { single: 'value' } as const
    const result = objectEntries(obj)
    expect(result).toEqual([['single', 'value']])
  })

  it('should preserve key types in for loop with explicit type annotations', () => {
    type ConfigKey = 'host' | 'port' | 'timeout'
    const config: Record<ConfigKey, number> = {
      host: 8080,
      port: 3000,
      timeout: 5000
    }

    const entries = objectEntries(config)
    const collected: Array<{ key: ConfigKey; value: number }> = []

    // Explicit type annotations demonstrate that key type is preserved
    for (const [key, value] of entries) {
      // TypeScript should infer key as ConfigKey, not string
      const typedKey: ConfigKey = key
      const typedValue: number = value
      collected.push({ key: typedKey, value: typedValue })
    }

    expect(collected).toEqual([
      { key: 'host', value: 8080 },
      { key: 'port', value: 3000 },
      { key: 'timeout', value: 5000 }
    ])

    // Verify that keys are the specific literal types, not just string
    expect(collected[0].key).toBe('host')
    expect(collected[1].key).toBe('port')
    expect(collected[2].key).toBe('timeout')
  })
})
