import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  hideWebGLVendorAndRenderer,
  noiseWebGLReadPixels,
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
    return 'webgl1-other'
  }
  MockWebGL.prototype.readPixels = function () { /* original */ }
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
  MockWebGL2.prototype.readPixels = function () { /* original */ }
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
      expect(getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Apple')
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
    })
  })

  describe('noiseWebGLReadPixels', () => {
    const { RGBA, UNSIGNED_BYTE } = WEBGL1_ENUMS
    const { PIXEL_PACK_BUFFER_BINDING } = WEBGL2_ENUMS

    type ReadPixelsFn = (
      x: number, y: number, width: number, height: number,
      format: number, type: number,
      pixelsOrOffset: ArrayBufferView | number | null,
      dstOffset?: number
    ) => void

    const onlyLsbDiffers = (actual: number, original: number): boolean =>
      (actual & ~1) === (original & ~1) && (actual === original || actual === (original ^ 1))

    beforeEach(() => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      originalWebGL = selfWith.WebGLRenderingContext
      originalWebGL2 = selfWith.WebGL2RenderingContext
      installMockWebGL(selfWith)
      installMockWebGL2(selfWith)
    })

    it('should call original readPixels and only noise the LSB', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      selfWith.WebGLRenderingContext!.prototype.readPixels = function (
        _x: number, _y: number, _w: number, _h: number,
        _format: number, _type: number,
        pixels: ArrayBufferView | null
      ) {
        if (pixels == null) return
        new Uint8Array(pixels.buffer, pixels.byteOffset, 4).set([10, 20, 30, 40])
      }
      noiseWebGLReadPixels(self)

      const pixels = new Uint8Array(4)
      const ctx = Object.create(selfWith.WebGLRenderingContext!.prototype) as WebGLRenderingContext
      ;(selfWith.WebGLRenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels
      )

      expect(onlyLsbDiffers(pixels[0], 10)).toBe(true)
      expect(onlyLsbDiffers(pixels[1], 20)).toBe(true)
      expect(onlyLsbDiffers(pixels[2], 30)).toBe(true)
      expect(onlyLsbDiffers(pixels[3], 40)).toBe(true)
    })

    it('should respect dstOffset when writing into an ArrayBufferView', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      selfWith.WebGLRenderingContext!.prototype.readPixels = function (
        _x: number, _y: number, _w: number, _h: number,
        _format: number, _type: number,
        pixels: ArrayBufferView | null,
        dstOffset?: number
      ) {
        if (pixels == null || !('BYTES_PER_ELEMENT' in pixels) || typeof pixels.BYTES_PER_ELEMENT !== 'number') return
        const byteOffset = (dstOffset ?? 0) * pixels.BYTES_PER_ELEMENT
        new Uint8Array(pixels.buffer, pixels.byteOffset + byteOffset, 4).set([10, 20, 30, 40])
      }
      noiseWebGLReadPixels(self)

      const pixels = new Uint8Array(8)
      pixels.fill(0xff)
      const ctx = Object.create(selfWith.WebGLRenderingContext!.prototype) as WebGLRenderingContext
      ;(selfWith.WebGLRenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels, 2
      )

      expect(pixels[0]).toBe(0xff)
      expect(pixels[1]).toBe(0xff)
      expect(onlyLsbDiffers(pixels[2], 10)).toBe(true)
      expect(onlyLsbDiffers(pixels[3], 20)).toBe(true)
      expect(onlyLsbDiffers(pixels[4], 30)).toBe(true)
      expect(onlyLsbDiffers(pixels[5], 40)).toBe(true)
      expect(pixels[6]).toBe(0xff)
      expect(pixels[7]).toBe(0xff)
    })

    it('should call original readPixels and noise the bound pixel-pack buffer', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      const originalReadPixels = jest.fn()
      selfWith.WebGL2RenderingContext!.prototype.readPixels = originalReadPixels
      noiseWebGLReadPixels(self)

      const packBuffer = {} as WebGLBuffer
      let writtenOffset = -1
      let writtenData: Uint8Array | undefined
      const ctx = Object.create(selfWith.WebGL2RenderingContext!.prototype) as WebGL2RenderingContext
      ctx.getParameter = (pname: number) => pname === PIXEL_PACK_BUFFER_BINDING ? packBuffer : null
      ctx.getBufferSubData = jest.fn((_target: number, _offset: number, dest: ArrayBufferView) => {
        new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength).fill(0xaa)
      })
      ctx.bufferSubData = jest.fn((_target: number, offset: number, data: ArrayBufferView) => {
        writtenOffset = offset
        writtenData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      })

      ;(selfWith.WebGL2RenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, 4
      )

      expect(originalReadPixels).toHaveBeenCalled()
      expect(writtenOffset).toBe(4)
      expect(writtenData).toHaveLength(16)
      expect(writtenData!.every((b) => onlyLsbDiffers(b, 0xaa))).toBe(true)
    })

    it('should still call original PBO readPixels when no pack buffer is bound', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      const originalReadPixels = jest.fn()
      selfWith.WebGL2RenderingContext!.prototype.readPixels = originalReadPixels
      noiseWebGLReadPixels(self)

      const bufferSubDataMock = jest.fn()
      const ctx = Object.create(selfWith.WebGL2RenderingContext!.prototype) as WebGL2RenderingContext
      ctx.getParameter = () => null
      ctx.bufferSubData = bufferSubDataMock

      ;(selfWith.WebGL2RenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, 0
      )

      expect(originalReadPixels).toHaveBeenCalled()
      expect(bufferSubDataMock).not.toHaveBeenCalled()
    })

    it('should not throw on an unsupported format/type combination', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      const originalReadPixels = jest.fn()
      selfWith.WebGLRenderingContext!.prototype.readPixels = originalReadPixels
      noiseWebGLReadPixels(self)

      const pixels = new Uint8Array(4)
      const ctx = Object.create(selfWith.WebGLRenderingContext!.prototype) as WebGLRenderingContext
      expect(() => {
        ;(selfWith.WebGLRenderingContext!.prototype.readPixels as ReadPixelsFn).call(
          ctx, 0, 0, 1, 1, 0xdead, UNSIGNED_BYTE, pixels
        )
      }).not.toThrow()
      expect(originalReadPixels).toHaveBeenCalled()
    })

    it('should chunk getRandomValues so large readPixels do not exceed the 65536-byte quota', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      selfWith.WebGLRenderingContext!.prototype.readPixels = function (
        _x: number, _y: number, _w: number, _h: number,
        _format: number, _type: number,
        pixels: ArrayBufferView | null
      ) {
        if (pixels == null) return
        new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength).fill(0x10)
      }
      noiseWebGLReadPixels(self)

      const spy = jest.spyOn(crypto, 'getRandomValues')
      try {
        const pixels = new Uint8Array(256 * 256 * 4)
        const ctx = Object.create(selfWith.WebGLRenderingContext!.prototype) as WebGLRenderingContext
        ;(selfWith.WebGLRenderingContext!.prototype.readPixels as ReadPixelsFn).call(
          ctx, 0, 0, 256, 256, RGBA, UNSIGNED_BYTE, pixels
        )
        expect(spy.mock.calls.length).toBeGreaterThan(1)
        for (const [view] of spy.mock.calls) {
          expect((view as ArrayBufferView).byteLength).toBeLessThanOrEqual(65536)
        }
        expect(pixels.every((b) => onlyLsbDiffers(b, 0x10))).toBe(true)
      } finally {
        spy.mockRestore()
      }
    })

    it('should patch WebGL1 readPixels when WebGL2RenderingContext is undefined', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      delete selfWith.WebGL2RenderingContext
      const originalReadPixels = jest.fn()
      selfWith.WebGLRenderingContext!.prototype.readPixels = originalReadPixels

      expect(() => noiseWebGLReadPixels(self)).not.toThrow()

      const pixels = new Uint8Array(4)
      const ctx = Object.create(selfWith.WebGLRenderingContext!.prototype) as WebGLRenderingContext
      ;(selfWith.WebGLRenderingContext!.prototype.readPixels as ReadPixelsFn).call(
        ctx, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels
      )
      expect(originalReadPixels).toHaveBeenCalled()
    })
  })
})
