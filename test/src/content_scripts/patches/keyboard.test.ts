import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import keyboard from '@src/content_scripts/patches/keyboard'

const mockKeyboard = {
  getLayoutMap: () => Promise.resolve(new Map()),
  lock: () => Promise.resolve(),
  unlock: () => Promise.resolve()
}

describe('keyboard patch', () => {
  let originalKeyboardDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    originalKeyboardDescriptor = Object.getOwnPropertyDescriptor(proto, 'keyboard')
    Object.defineProperty(proto, 'keyboard', { value: mockKeyboard, configurable: true, enumerable: true })
  })

  afterEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    if (originalKeyboardDescriptor !== undefined) {
      Object.defineProperty(proto, 'keyboard', originalKeyboardDescriptor)
    } else {
      delete (proto as unknown as Record<string, unknown>).keyboard
    }
  })

  describe('without patch', () => {
    it('should return original keyboard', () => {
      expect((navigator as { keyboard?: typeof mockKeyboard }).keyboard).toBe(mockKeyboard)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      keyboard()
    })

    it('should set keyboard to undefined', () => {
      expect((navigator as { keyboard?: unknown }).keyboard).toBeUndefined()
    })
  })
})
