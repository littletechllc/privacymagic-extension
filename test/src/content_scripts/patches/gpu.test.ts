import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import gpu from '@src/content_scripts/patches/gpu'

type SelfWithCanvas = { HTMLCanvasElement?: typeof HTMLCanvasElement }

describe('gpu patch', () => {
  let originalHTMLCanvasElement: typeof HTMLCanvasElement | undefined

  describe('when HTMLCanvasElement is undefined', () => {
    beforeEach(() => {
      const selfWith = self as unknown as SelfWithCanvas
      originalHTMLCanvasElement = selfWith.HTMLCanvasElement
      delete selfWith.HTMLCanvasElement
    })

    afterEach(() => {
      const selfWith = self as unknown as SelfWithCanvas
      if (originalHTMLCanvasElement !== undefined) {
        selfWith.HTMLCanvasElement = originalHTMLCanvasElement
      }
    })

    it('should return a no-op function instead of patching', () => {
      const result = gpu()
      expect(typeof result).toBe('function')
      expect(() => (result as () => void)()).not.toThrow()
    })
  })

  describe('when canvas stack is available', () => {
    it('should not throw when applied', () => {
      if (typeof globalThis.CanvasRenderingContext2D === 'undefined') return
      expect(() => gpu()).not.toThrow()
    })
  })
})
