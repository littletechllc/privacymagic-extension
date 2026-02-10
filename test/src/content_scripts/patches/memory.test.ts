import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import memory from '@src/content_scripts/patches/memory'

const mockDeviceMemory = 8

describe('memory patch', () => {
  const nav = navigator as unknown as Record<string, unknown>

  beforeEach(() => {
    Object.defineProperty(navigator, 'deviceMemory', {
      value: mockDeviceMemory,
      configurable: true,
      enumerable: true
    })
  })

  afterEach(() => {
    delete nav.deviceMemory
  })

  describe('without patch', () => {
    it('should return original deviceMemory', () => {
      expect((navigator as { deviceMemory?: number }).deviceMemory).toBe(mockDeviceMemory)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      delete nav.deviceMemory
      memory()
    })

    it('should set deviceMemory to undefined', () => {
      expect((navigator as { deviceMemory?: number }).deviceMemory).toBeUndefined()
    })
  })
})
