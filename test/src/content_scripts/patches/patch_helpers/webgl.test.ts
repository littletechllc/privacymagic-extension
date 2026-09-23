import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  hideWebGLVendorAndRenderer,
  webglVendorAndRendererByPlatform
} from '@src/content_scripts/patches/patch_helpers/webgl'

const UNMASKED_VENDOR_WEBGL = 37445
const UNMASKED_RENDERER_WEBGL = 37446

type NavWithUAData = { userAgentData?: { platform: string } | null }
type SelfWithWebGL = { WebGLRenderingContext?: typeof WebGLRenderingContext }
type SelfWithWebGLContexts = SelfWithWebGL & {
  WebGL2RenderingContext?: typeof WebGL2RenderingContext
}

const WEBGL1_ENUMS = {
  ALPHA: 0x1906,
  RGB: 0x1907,
  RGBA: 0x1908,
  LUMINANCE: 0x1909,
  LUMINANCE_ALPHA: 0x190A,
  UNSIGNED_BYTE: 0x1401,
  FLOAT: 0x1406,
  UNSIGNED_SHORT_5_6_5: 0x8363,
  UNSIGNED_SHORT_4_4_4_4: 0x8033,
  UNSIGNED_SHORT_5_5_5_1: 0x8034,
} as const

const WEBGL2_ENUMS = {
  RED: 0x1903,
  RG: 0x8227,
  RED_INTEGER: 0x8D94,
  RG_INTEGER: 0x8228,
  RGB_INTEGER: 0x8D98,
  RGBA_INTEGER: 0x8D99,
  BYTE: 0x1400,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  INT: 0x1404,
  UNSIGNED_INT: 0x1405,
  HALF_FLOAT: 0x140B,
  UNSIGNED_INT_2_10_10_10_REV: 0x8368,
  UNSIGNED_INT_10F_11F_11F_REV: 0x8C3B,
  UNSIGNED_INT_5_9_9_9_REV: 0x8C3A,
  PIXEL_PACK_BUFFER: 0x88EB,
  PIXEL_PACK_BUFFER_BINDING: 0x88ED,
} as const

function installMockWebGL (selfWith: SelfWithWebGL): typeof WebGLRenderingContext {
  const MockWebGL = function (this: WebGLRenderingContext) {} as unknown as typeof WebGLRenderingContext
  Object.assign(MockWebGL, WEBGL1_ENUMS)
  MockWebGL.prototype.getParameter = function (constant: number): unknown {
    if (constant === UNMASKED_VENDOR_WEBGL) return 'LeakyVendor'
    if (constant === UNMASKED_RENDERER_WEBGL) return 'LeakyRenderer'
    return 'webgl1-other'
  }
  selfWith.WebGLRenderingContext = MockWebGL
  return MockWebGL
}

function installMockWebGL2 (selfWith: SelfWithWebGLContexts): typeof WebGL2RenderingContext {
  const MockWebGL2 = function (this: WebGL2RenderingContext) {} as unknown as typeof WebGL2RenderingContext
  Object.assign(MockWebGL2, WEBGL2_ENUMS)
  MockWebGL2.prototype.getParameter = function (constant: number): unknown {
    if (constant === UNMASKED_VENDOR_WEBGL) return 'LeakyVendor'
    if (constant === UNMASKED_RENDERER_WEBGL) return 'LeakyRenderer'
    if (constant === WEBGL2_ENUMS.PIXEL_PACK_BUFFER_BINDING) return 'webgl2-pack-binding'
    return 'webgl2-other'
  }
  selfWith.WebGL2RenderingContext = MockWebGL2
  return MockWebGL2
}

function getPatchedGetParameter (
  selfWith: SelfWithWebGL,
  context: 'WebGLRenderingContext' | 'WebGL2RenderingContext' = 'WebGLRenderingContext'
): (constant: number) => unknown {
  const ctor = context === 'WebGL2RenderingContext'
    ? (selfWith as SelfWithWebGLContexts).WebGL2RenderingContext
    : selfWith.WebGLRenderingContext
  const proto = ctor!.prototype
  const ctx = Object.create(proto) as WebGLRenderingContext
  return (constant: number): unknown => proto.getParameter.call(ctx, constant)
}

describe('patch_helpers/webgl', () => {
  let originalWebGL: typeof WebGLRenderingContext | undefined
  let originalWebGL2: typeof WebGL2RenderingContext | undefined
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
    const selfWith = self as unknown as SelfWithWebGLContexts
    if (originalWebGL !== undefined) {
      selfWith.WebGLRenderingContext = originalWebGL
    } else {
      delete selfWith.WebGLRenderingContext
    }
    if (originalWebGL2 !== undefined) {
      selfWith.WebGL2RenderingContext = originalWebGL2
    } else {
      delete selfWith.WebGL2RenderingContext
    }
  })

  describe('hideWebGLVendorAndRenderer', () => {
    it('should no-op when WebGLRenderingContext is undefined', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      originalWebGL = selfWith.WebGLRenderingContext
      originalWebGL2 = selfWith.WebGL2RenderingContext
      delete selfWith.WebGLRenderingContext
      delete selfWith.WebGL2RenderingContext
      expect(() => hideWebGLVendorAndRenderer(self)).not.toThrow()
    })

    it('should no-op when navigator.userAgentData is null', () => {
      if (typeof self.WebGLRenderingContext === 'undefined') return
      const nav = navigator as unknown as NavWithUAData
      nav.userAgentData = null
      expect(() => hideWebGLVendorAndRenderer(self)).not.toThrow()
    })

    it('should not throw when WebGL2RenderingContext is undefined', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      originalWebGL = selfWith.WebGLRenderingContext
      originalWebGL2 = selfWith.WebGL2RenderingContext
      installMockWebGL(selfWith)
      delete selfWith.WebGL2RenderingContext

      const nav = navigator as unknown as NavWithUAData
      nav.userAgentData = { platform: 'macOS' }

      expect(() => hideWebGLVendorAndRenderer(self)).not.toThrow()
      const getParameter = getPatchedGetParameter(selfWith)
      expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Apple Inc.')
    })

    describe('when WebGL and userAgentData.platform are available', () => {
      beforeEach(() => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        originalWebGL = selfWith.WebGLRenderingContext
        originalWebGL2 = selfWith.WebGL2RenderingContext
        if (selfWith.WebGLRenderingContext === undefined) {
          installMockWebGL(selfWith)
        }
        if (selfWith.WebGL2RenderingContext === undefined) {
          installMockWebGL2(selfWith)
        }
      })

      it.each(
        Object.entries(webglVendorAndRendererByPlatform)
      )('should spoof UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL on %s', (platform, expected) => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGLRenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith)

        expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe(expected.vendor)
        expect(getParameter(UNMASKED_RENDERER_WEBGL)).toBe(expected.renderer)
      })

      it.each(
        Object.entries(webglVendorAndRendererByPlatform)
      )('should spoof WebGL2 UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL on %s', (platform, expected) => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGL2RenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith, 'WebGL2RenderingContext')

        expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe(expected.vendor)
        expect(getParameter(UNMASKED_RENDERER_WEBGL)).toBe(expected.renderer)
      })

      it('should return Unknown for an unrecognized platform', () => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGLRenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'Chrome OS' }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith)

        expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Unknown')
        expect(getParameter(UNMASKED_RENDERER_WEBGL)).toBe('Unknown')
      })

      it('should return Unknown on WebGL2 for an unrecognized platform', () => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGL2RenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'Chrome OS' }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith, 'WebGL2RenderingContext')

        expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Unknown')
        expect(getParameter(UNMASKED_RENDERER_WEBGL)).toBe('Unknown')
      })

      it('should pass through other getParameter constants', () => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGLRenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'macOS' }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith)

        expect(getParameter(0)).toBe('webgl1-other')
      })

      it('should pass through other WebGL2 getParameter constants', () => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGL2RenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'macOS' }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith, 'WebGL2RenderingContext')

        expect(getParameter(0)).toBe('webgl2-other')
      })

      it('should use the WebGL2 native getParameter for WebGL2-only pnames', () => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGL2RenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'macOS' }

        hideWebGLVendorAndRenderer(self)
        const getParameter = getPatchedGetParameter(selfWith, 'WebGL2RenderingContext')

        expect(getParameter(WEBGL2_ENUMS.PIXEL_PACK_BUFFER_BINDING)).toBe('webgl2-pack-binding')
      })

      it('should keep WebGL1 and WebGL2 getParameter originals distinct after one patch call', () => {
        const selfWith = self as unknown as SelfWithWebGLContexts
        if (selfWith.WebGLRenderingContext === undefined || selfWith.WebGL2RenderingContext === undefined) return

        const nav = navigator as unknown as NavWithUAData
        nav.userAgentData = { platform: 'macOS' }

        hideWebGLVendorAndRenderer(self)
        const getParameterWebGL1 = getPatchedGetParameter(selfWith)
        const getParameterWebGL2 = getPatchedGetParameter(selfWith, 'WebGL2RenderingContext')

        expect(getParameterWebGL1(UNMASKED_VENDOR_WEBGL)).toBe('Apple Inc.')
        expect(getParameterWebGL2(UNMASKED_VENDOR_WEBGL)).toBe('Apple Inc.')
        expect(getParameterWebGL1(0)).toBe('webgl1-other')
        expect(getParameterWebGL2(0)).toBe('webgl2-other')
        expect(getParameterWebGL2(WEBGL2_ENUMS.PIXEL_PACK_BUFFER_BINDING)).toBe('webgl2-pack-binding')
      })
    })
  })
})
