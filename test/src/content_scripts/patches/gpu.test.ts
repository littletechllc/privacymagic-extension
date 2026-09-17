import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import gpu from '@src/content_scripts/patches/gpu'

const UNMASKED_VENDOR_WEBGL = 37445
const UNMASKED_RENDERER_WEBGL = 37446
const RGBA = 0x1908
const UNSIGNED_BYTE = 0x1401
const PIXEL_PACK_BUFFER_BINDING = 0x88ED

type NavWithUAData = { userAgentData?: { platform: string } | null }
type SelfWithWebGLContexts = {
  WebGLRenderingContext?: typeof WebGLRenderingContext
  WebGL2RenderingContext?: typeof WebGL2RenderingContext
}

const canvasSupported = typeof globalThis.CanvasRenderingContext2D !== 'undefined'

const onlyLsbDiffers = (actual: number, original: number): boolean =>
  (actual & ~1) === (original & ~1) && (actual === original || actual === (original ^ 1))

function installMockWebGL (selfWith: SelfWithWebGLContexts): void {
  const MockWebGL = function (this: WebGLRenderingContext) {} as unknown as typeof WebGLRenderingContext
  Object.assign(MockWebGL, { RGBA, UNSIGNED_BYTE })
  MockWebGL.prototype.getParameter = function (constant: number): unknown {
    if (constant === UNMASKED_VENDOR_WEBGL) return 'LeakyVendor'
    if (constant === UNMASKED_RENDERER_WEBGL) return 'LeakyRenderer'
    return 'webgl1-other'
  }
  MockWebGL.prototype.readPixels = function (
    _x: number, _y: number, _w: number, _h: number,
    _format: number, _type: number,
    pixels: ArrayBufferView | null
  ) {
    if (pixels == null) return
    new Uint8Array(pixels.buffer, pixels.byteOffset, 4).set([10, 20, 30, 40])
  }
  selfWith.WebGLRenderingContext = MockWebGL

  const MockWebGL2 = function (this: WebGL2RenderingContext) {} as unknown as typeof WebGL2RenderingContext
  Object.assign(MockWebGL2, { PIXEL_PACK_BUFFER_BINDING })
  MockWebGL2.prototype.getParameter = function (constant: number): unknown {
    if (constant === UNMASKED_VENDOR_WEBGL) return 'LeakyVendor'
    if (constant === UNMASKED_RENDERER_WEBGL) return 'LeakyRenderer'
    if (constant === PIXEL_PACK_BUFFER_BINDING) return 'webgl2-pack-binding'
    return 'webgl2-other'
  }
  MockWebGL2.prototype.readPixels = function () { /* original */ }
  selfWith.WebGL2RenderingContext = MockWebGL2
}

describe('gpu patch', () => {
  describe('when canvas stack is available', () => {
    it('should not throw when applied', () => {
      if (!canvasSupported) return
      expect(() => gpu(self)).not.toThrow()
    })

    it('should leave toDataURL on the native path when there is no 2d context', () => {
      if (!canvasSupported) return
      const distinctiveDataUrl = 'data:image/png;base64,NATIVE'
      const proto = HTMLCanvasElement.prototype
      /* eslint-disable @typescript-eslint/unbound-method */
      const originalToDataURL = proto.toDataURL
      /* eslint-enable @typescript-eslint/unbound-method */
      proto.toDataURL = function () { return distinctiveDataUrl }
      try {
        gpu(self)
        const canvas = document.createElement('canvas')
        expect(canvas.toDataURL()).toBe(distinctiveDataUrl)
      } finally {
        proto.toDataURL = originalToDataURL
      }
    })
  })

  describe('when WebGL constructors are mocked', () => {
    let originalWebGL: typeof WebGLRenderingContext | undefined
    let originalWebGL2: typeof WebGL2RenderingContext | undefined
    let originalUserAgentData: unknown

    beforeEach(() => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      const nav = navigator as unknown as NavWithUAData
      originalWebGL = selfWith.WebGLRenderingContext
      originalWebGL2 = selfWith.WebGL2RenderingContext
      originalUserAgentData = nav.userAgentData
      installMockWebGL(selfWith)
      nav.userAgentData = { platform: 'macOS' }
    })

    afterEach(() => {
      const selfWith = self as unknown as SelfWithWebGLContexts
      const nav = navigator as unknown as NavWithUAData
      if (originalUserAgentData !== undefined) {
        nav.userAgentData = originalUserAgentData as NavWithUAData['userAgentData']
      }
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

    it('should spoof unmasked vendor/renderer and noise readPixels together', () => {
      const selfWith = self as unknown as SelfWithWebGLContexts & { HTMLCanvasElement?: typeof HTMLCanvasElement }
      const originalCanvas = selfWith.HTMLCanvasElement
      delete selfWith.HTMLCanvasElement
      try {
        gpu(self)

        const webgl1 = Object.create(selfWith.WebGLRenderingContext!.prototype) as WebGLRenderingContext
        expect(webgl1.getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Apple')
        expect(webgl1.getParameter(UNMASKED_RENDERER_WEBGL)).toBe('Apple M1')
        expect(webgl1.getParameter(0)).toBe('webgl1-other')

        const webgl2 = Object.create(selfWith.WebGL2RenderingContext!.prototype) as WebGL2RenderingContext
        expect(webgl2.getParameter(UNMASKED_VENDOR_WEBGL)).toBe('Apple')
        expect(webgl2.getParameter(PIXEL_PACK_BUFFER_BINDING)).toBe('webgl2-pack-binding')

        const pixels = new Uint8Array(4)
        webgl1.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels)
        expect(onlyLsbDiffers(pixels[0], 10)).toBe(true)
        expect(onlyLsbDiffers(pixels[1], 20)).toBe(true)
        expect(onlyLsbDiffers(pixels[2], 30)).toBe(true)
        expect(onlyLsbDiffers(pixels[3], 40)).toBe(true)
      } finally {
        if (originalCanvas !== undefined) {
          selfWith.HTMLCanvasElement = originalCanvas
        }
      }
    })
  })
})
