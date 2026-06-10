import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  hideWebGLVendorAndRenderer,
  returnNoisedBlankImageForWebGLContext,
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
    return null
  }
  MockWebGL.prototype.readPixels = function () { /* original */ }
  selfWith.WebGLRenderingContext = MockWebGL
  return MockWebGL
}

function installMockWebGL2 (selfWith: SelfWithWebGLContexts): typeof WebGL2RenderingContext {
  const MockWebGL2 = function (this: WebGL2RenderingContext) {} as unknown as typeof WebGL2RenderingContext
  Object.assign(MockWebGL2, WEBGL2_ENUMS)
  MockWebGL2.prototype.readPixels = function () { /* original */ }
  selfWith.WebGL2RenderingContext = MockWebGL2
  return MockWebGL2
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

  describe('returnNoisedBlankImageForWebGLContext', () => {
    const { RGBA, UNSIGNED_BYTE } = WEBGL1_ENUMS
    const { PIXEL_PACK_BUFFER_BINDING } = WEBGL2_ENUMS

    type ReadPixelsFn = (
      x: number, y: number, width: number, height: number,
      format: number, type: number,
      pixelsOrOffset: ArrayBufferView | number | null,
      dstOffset?: number
    ) => void

    let originalWebGL2: typeof WebGL2RenderingContext | undefined

    beforeEach(() => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      originalWebGL = selfWith.WebGLRenderingContext
      originalWebGL2 = selfWith.WebGL2RenderingContext
      installMockWebGL(selfWith)
      installMockWebGL2(selfWith)
    })

    afterEach(() => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      if (originalWebGL2 !== undefined) {
        selfWith.WebGL2RenderingContext = originalWebGL2
      } else {
        delete selfWith.WebGL2RenderingContext
      }
    })

    it('should respect dstOffset when writing into an ArrayBufferView', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      returnNoisedBlankImageForWebGLContext(self)

      const pixels = new Uint8Array(8)
      pixels.fill(0xff)
      const ctx = Object.create(selfWith.WebGLRenderingContext!.prototype) as WebGLRenderingContext
      ;(selfWith.WebGLRenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels, 2
      )

      expect(pixels[0]).toBe(0xff)
      expect(pixels[1]).toBe(0xff)
      expect(pixels.slice(2, 6).every((b) => b === 0 || b === 1)).toBe(true)
      expect(pixels[6]).toBe(0xff)
      expect(pixels[7]).toBe(0xff)
    })

    it('should write LSB noise into the bound pixel-pack buffer', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      returnNoisedBlankImageForWebGLContext(self)

      const packBuffer = {} as WebGLBuffer
      let writtenOffset = -1
      let writtenData: Uint8Array | undefined
      const ctx = Object.create(selfWith.WebGL2RenderingContext!.prototype) as WebGL2RenderingContext
      ctx.getParameter = (pname: number) => pname === PIXEL_PACK_BUFFER_BINDING ? packBuffer : null
      ctx.bindBuffer = jest.fn()
      ctx.bufferSubData = jest.fn((_target: number, offset: number, data: ArrayBufferView) => {
        writtenOffset = offset
        writtenData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      })

      ;(selfWith.WebGL2RenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, 4
      )

      expect(writtenOffset).toBe(4)
      expect(writtenData).toHaveLength(16)
      expect(writtenData!.every((b) => b === 0 || b === 1)).toBe(true)
    })

    it('should no-op PBO readPixels when no pack buffer is bound', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      returnNoisedBlankImageForWebGLContext(self)

      const bufferSubDataMock = jest.fn()
      const ctx = Object.create(selfWith.WebGL2RenderingContext!.prototype) as WebGL2RenderingContext
      ctx.getParameter = () => null
      ctx.bindBuffer = jest.fn()
      ctx.bufferSubData = bufferSubDataMock

      ;(selfWith.WebGL2RenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, 0
      )

      expect(bufferSubDataMock).not.toHaveBeenCalled()
    })
  })
})
