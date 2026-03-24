import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import cpu from '@src/content_scripts/patches/cpu'
import { defineMockProperties } from '@test/mocks/define'

const mockHardwareConcurrency = 8
const mockCpuClass = 'arm'

describe('cpu patch', () => {
  beforeEach(() => {
    defineMockProperties(self.Navigator.prototype, {
      hardwareConcurrency: mockHardwareConcurrency,
      cpuClass: mockCpuClass
    })
  })

  describe('without patch', () => {
    it('should return original hardwareConcurrency and cpuClass', () => {
      expect(navigator.hardwareConcurrency).toBe(mockHardwareConcurrency)
      expect((navigator as { cpuClass?: string }).cpuClass).toBe(mockCpuClass)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      cpu(self)
    })

    it('should set hardwareConcurrency to 4', () => {
      expect(navigator.hardwareConcurrency).toBe(4)
    })

    it('should set cpuClass to undefined', () => {
      expect((navigator as { cpuClass?: string }).cpuClass).toBeUndefined()
    })
  })
})
