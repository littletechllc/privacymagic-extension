import {describe, it, expect } from '@jest/globals'
import gpu from '@src/content_scripts/patches/gpu'

describe('gpu patch', () => {
  describe('when canvas stack is available', () => {
    it('should not throw when applied', () => {
      if (typeof globalThis.CanvasRenderingContext2D === 'undefined') return
      expect(() => gpu(self)).not.toThrow()
    })
  })
})
