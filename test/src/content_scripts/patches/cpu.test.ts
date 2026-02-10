import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import cpu from '@src/content_scripts/patches/cpu'

const mockHardwareConcurrency = 8
const mockCpuClass = 'arm'

describe('cpu patch', () => {
  const nav = navigator as unknown as Record<string, unknown>

  beforeEach(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: mockHardwareConcurrency,
      configurable: true,
      enumerable: true
    })
    Object.defineProperty(navigator, 'cpuClass', {
      value: mockCpuClass,
      configurable: true,
      enumerable: true
    })
  })

  afterEach(() => {
    delete nav.hardwareConcurrency
    delete nav.cpuClass
  })

  describe('without patch', () => {
    it('should return original hardwareConcurrency and cpuClass', () => {
      expect(navigator.hardwareConcurrency).toBe(mockHardwareConcurrency)
      expect((navigator as { cpuClass?: string }).cpuClass).toBe(mockCpuClass)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      delete nav.hardwareConcurrency
      delete nav.cpuClass
      cpu()
    })

    it('should set hardwareConcurrency to 4', () => {
      expect(navigator.hardwareConcurrency).toBe(4)
    })

    it('should set cpuClass to undefined', () => {
      expect((navigator as { cpuClass?: string }).cpuClass).toBeUndefined()
    })
  })
})
