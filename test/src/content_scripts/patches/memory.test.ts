import {describe, it, expect, beforeEach } from '@jest/globals'
import memory from '@src/content_scripts/patches/memory'
import { defineMockProperties } from '@test/mocks/define'

const mockDeviceMemory = 8

describe('memory patch', () => {

  describe('when deviceMemory exists', () => {
    beforeEach(() => {
      // Match `redefineNavigatorFields`: own props on `Navigator.prototype` (not the `navigator` instance).
      defineMockProperties(self.Navigator.prototype, { deviceMemory: mockDeviceMemory })
    })

    describe('without patch', () => {
      it('should return original deviceMemory', () => {
        expect((navigator as { deviceMemory?: number }).deviceMemory).toBe(mockDeviceMemory)
      })
    })

    describe('with patch enabled', () => {
      beforeEach(() => {
        memory(self)
      })

      it('should set deviceMemory to undefined', () => {
        expect((navigator as { deviceMemory?: number }).deviceMemory).toBeUndefined()
      })
    })
  })

  describe('when deviceMemory is absent', () => {
    beforeEach(() => {
      Reflect.deleteProperty(self.Navigator.prototype, 'deviceMemory')
    })

    it('should no-op without throwing', () => {
      expect('deviceMemory' in navigator).toBe(false)
      expect(() => memory(self)).not.toThrow()
      expect('deviceMemory' in navigator).toBe(false)
    })
  })
})
