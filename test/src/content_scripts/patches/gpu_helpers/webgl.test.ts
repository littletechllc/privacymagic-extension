import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import { hideWebGLVendorAndRenderer } from '@src/content_scripts/patches/gpu_helpers/webgl'

const UNMASKED_VENDOR_WEBGL = 37445
const UNMASKED_RENDERER_WEBGL = 37446

type NavWithUAData = { userAgentData?: { platform: string } | null }
type SelfWithWebGL = { WebGLRenderingContext?: typeof WebGLRenderingContext }

describe('gpu_helpers/webgl', () => {
  let originalWebGL: typeof WebGLRenderingContext | undefined
  let originalUserAgentData: unknown

  beforeEach(() => {
    const nav = navigator as unknown as NavWithUAData
    originalUserAgentData = nav.userAgentData
  })

  afterEach(() => {
    const nav = navigator as unknown as NavWithUAData
    if (originalUserAgentData !== undefined) {
      nav.userAgentData = originalUserAgentData as NavWithUAData['userAgentData']
    }
    const selfWith = self as unknown as SelfWithWebGL
    if (originalWebGL !== undefined) {
      selfWith.WebGLRenderingContext = originalWebGL
    } else {
      delete selfWith.WebGLRenderingContext
    }
  })

  describe('hideWebGLVendorAndRenderer', () => {
    it('should no-op when WebGLRenderingContext is undefined', () => {
      const selfWith = self as unknown as SelfWithWebGL
      originalWebGL = selfWith.WebGLRenderingContext
      delete selfWith.WebGLRenderingContext
      expect(() => hideWebGLVendorAndRenderer()).not.toThrow()
    })

    it('should no-op when navigator.userAgentData is null', () => {
      if (typeof self.WebGLRenderingContext === 'undefined') return
      const nav = navigator as unknown as NavWithUAData
      nav.userAgentData = null
      expect(() => hideWebGLVendorAndRenderer()).not.toThrow()
    })

    describe('when WebGL and userAgentData.platform are available', () => {
      beforeEach(() => {
        const selfWith = self as unknown as SelfWithWebGL
        if (selfWith.WebGLRenderingContext === undefined) {
          // Mock WebGL so we can test without a real GPU; getParameter must be on prototype for createSafeMethod
          const MockWebGL = function (this: WebGLRenderingContext) {} as unknown as typeof WebGLRenderingContext
          MockWebGL.prototype.getParameter = function (constant: number): unknown {
            if (constant === UNMASKED_VENDOR_WEBGL) return 'LeakyVendor'
            if (constant === UNMASKED_RENDERER_WEBGL) return 'LeakyRenderer'
            return null
          }
          originalWebGL = selfWith.WebGLRenderingContext
          selfWith.WebGLRenderingContext = MockWebGL
        }
        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'macOS' }
      })

      it('should spoof UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL on macOS', () => {
        const selfWith = self as unknown as SelfWithWebGL
        if (selfWith.WebGLRenderingContext === undefined) return
        hideWebGLVendorAndRenderer()
        const proto = selfWith.WebGLRenderingContext.prototype
        const ctx = Object.create(proto) as WebGLRenderingContext
        expect(proto.getParameter.call(ctx, UNMASKED_VENDOR_WEBGL)).toBe('Apple')
        expect(proto.getParameter.call(ctx, UNMASKED_RENDERER_WEBGL)).toBe('Apple M1')
      })

      it('should pass through other getParameter constants', () => {
        const selfWith = self as unknown as SelfWithWebGL
        if (selfWith.WebGLRenderingContext === undefined) return
        hideWebGLVendorAndRenderer()
        const proto = selfWith.WebGLRenderingContext.prototype
        const ctx = Object.create(proto) as WebGLRenderingContext
        // Some arbitrary constant; original mock returns null
        expect(proto.getParameter.call(ctx, 0)).toBe(null)
      })
    })
  })
})
