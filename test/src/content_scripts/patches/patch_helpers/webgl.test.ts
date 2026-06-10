import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  hideWebGLVendorAndRenderer,
  webglVendorAndRendererByPlatform
} from '@src/content_scripts/patches/patch_helpers/webgl'

const UNMASKED_VENDOR_WEBGL = 37445
const UNMASKED_RENDERER_WEBGL = 37446

type NavWithUAData = { userAgentData?: { platform: string } | null }
type SelfWithWebGL = { WebGLRenderingContext?: typeof WebGLRenderingContext }

function installMockWebGL (selfWith: SelfWithWebGL): typeof WebGLRenderingContext {
  const MockWebGL = function (this: WebGLRenderingContext) {} as unknown as typeof WebGLRenderingContext
  MockWebGL.prototype.getParameter = function (constant: number): unknown {
    if (constant === UNMASKED_VENDOR_WEBGL) return 'LeakyVendor'
    if (constant === UNMASKED_RENDERER_WEBGL) return 'LeakyRenderer'
    return null
  }
  selfWith.WebGLRenderingContext = MockWebGL
  return MockWebGL
}

function getPatchedGetParameter (selfWith: SelfWithWebGL): (constant: number) => unknown {
  const proto = selfWith.WebGLRenderingContext!.prototype
  const ctx = Object.create(proto) as WebGLRenderingContext
  return (constant: number): unknown => {
    const result: unknown = proto.getParameter.call(ctx, constant)
    return result
  }
}

describe('patch_helpers/webgl', () => {
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
      expect(() => hideWebGLVendorAndRenderer(self)).not.toThrow()
    })

    it('should no-op when navigator.userAgentData is null', () => {
      if (typeof self.WebGLRenderingContext === 'undefined') return
      const nav = navigator as unknown as NavWithUAData
      nav.userAgentData = null
      expect(() => hideWebGLVendorAndRenderer(self)).not.toThrow()
    })

    describe('when WebGL and userAgentData.platform are available', () => {
      beforeEach(() => {
        const selfWith = self as unknown as SelfWithWebGL
        if (selfWith.WebGLRenderingContext === undefined) {
          originalWebGL = selfWith.WebGLRenderingContext
          installMockWebGL(selfWith)
        }
      })

      it.each(
        Object.entries(webglVendorAndRendererByPlatform)
      )('should spoof UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL on %s', (platform, expected) => {
        const selfWith = self as unknown as SelfWithWebGL
        if (selfWith.WebGLRenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith)

        expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe(expected.vendor)
        expect(getParameter(UNMASKED_RENDERER_WEBGL)).toBe(expected.renderer)
      })

      it('should return Unknown for an unrecognized platform', () => {
        const selfWith = self as unknown as SelfWithWebGL
        if (selfWith.WebGLRenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'Chrome OS' }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith)

        expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Unknown')
        expect(getParameter(UNMASKED_RENDERER_WEBGL)).toBe('Unknown')
      })

      it('should pass through other getParameter constants', () => {
        const selfWith = self as unknown as SelfWithWebGL
        if (selfWith.WebGLRenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'macOS' }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith)

        expect(getParameter(0)).toBe(null)
      })
    })
  })
})
