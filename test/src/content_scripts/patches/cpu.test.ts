import {describe, it, expect, beforeEach } from '@jest/globals'
import cpu from '@src/content_scripts/patches/cpu'
import { defineMockProperties } from '@test/mocks/define'

const mockHardwareConcurrency = 8

describe('cpu patch', () => {
  beforeEach(() => {
    defineMockProperties(self.Navigator.prototype, {
      hardwareConcurrency: mockHardwareConcurrency,
    })
  })

  describe('without patch', () => {
    it('should return original hardwareConcurrency and cpuClass', () => {
      expect(navigator.hardwareConcurrency).toBe(mockHardwareConcurrency)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      cpu(self)
    })

    it('should set hardwareConcurrency to a stable integer from 4 to 8', () => {
      const value = navigator.hardwareConcurrency
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(4)
      expect(value).toBeLessThanOrEqual(8)
      expect(navigator.hardwareConcurrency).toBe(value)
    })
  })
})
