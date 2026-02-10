import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import touch from '@src/content_scripts/patches/touch'

const leakyMaxTouchPoints = 5

describe('touch patch', () => {
  let originalMaxTouchPointsDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(proto, 'maxTouchPoints')
    Object.defineProperty(proto, 'maxTouchPoints', {
      value: leakyMaxTouchPoints,
      configurable: true,
      enumerable: true
    })
  })

  afterEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    if (originalMaxTouchPointsDescriptor !== undefined) {
      Object.defineProperty(proto, 'maxTouchPoints', originalMaxTouchPointsDescriptor)
    } else {
      delete (proto as unknown as Record<string, unknown>).maxTouchPoints
    }
  })

  describe('without patch', () => {
    it('should leak maxTouchPoints', () => {
      expect(navigator.maxTouchPoints).toBe(leakyMaxTouchPoints)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      touch()
    })

    it('should set maxTouchPoints to 0', () => {
      expect(navigator.maxTouchPoints).toBe(0)
    })
  })
})
