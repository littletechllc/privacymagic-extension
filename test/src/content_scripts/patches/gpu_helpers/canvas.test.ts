import {describe, it, expect, beforeEach, beforeAll} from '@jest/globals'
import { enableCanvasFingerprintSpoofing } from '@src/content_scripts/patches/gpu_helpers/canvas'

// In jsdom without the canvas package, CanvasRenderingContext2D is undefined and enableCanvasFingerprintSpoofing() would throw.
const canvasSupported = typeof globalThis.CanvasRenderingContext2D !== 'undefined'

// Record which context/canvas received draw vs read calls (set up in beforeAll so patch wraps our wrappers).
let drawCallContexts: CanvasRenderingContext2D[] = []
let getImageDataContexts: CanvasRenderingContext2D[] = []
let toDataURLCanvases: HTMLCanvasElement[] = []

describe('gpu_helpers/canvas', () => {
  const get2dContext = (): CanvasRenderingContext2D | null => {
    try {
      const canvas = document.createElement('canvas')
      return canvas.getContext('2d')
    } catch {
      return null
    }
  }

  describe('enableCanvasFingerprintSpoofing', () => {
    beforeEach(() => {
      if (!canvasSupported) return
      enableCanvasFingerprintSpoofing()
    })

    it('should not throw when applied', () => {
      if (!canvasSupported) return
      expect(() => enableCanvasFingerprintSpoofing()).not.toThrow()
    })

    it('getContext("2d") should return a context when supported', () => {
      if (!canvasSupported) return
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      expect(ctx).toBeDefined()
      expect(ctx.canvas).toBe(canvas)
    })

    it('measureText should return a TextMetrics-like object', () => {
      if (!canvasSupported) return
      const ctx = get2dContext()
      if (ctx === null) return
      const metrics = ctx.measureText('test')
      expect(metrics).toBeDefined()
      expect(typeof metrics.width).toBe('number')
    })

    it('getImageData should return ImageData with correct dimensions', () => {
      if (!canvasSupported) return
      const ctx = get2dContext()
      if (ctx === null) return
      const w = 10
      const h = 10
      const imageData = ctx.getImageData(0, 0, w, h)
      expect(imageData).toBeInstanceOf(ImageData)
      expect(imageData.width).toBe(w)
      expect(imageData.height).toBe(h)
      expect(imageData.data.length).toBe(w * h * 4)
    })

    it('isPointInPath / isPointInStroke should return booleans', () => {
      if (!canvasSupported) return
      const ctx = get2dContext()
      if (ctx === null) return
      expect(typeof ctx.isPointInPath(0, 0)).toBe('boolean')
      expect(typeof ctx.isPointInStroke(0, 0)).toBe('boolean')
    })

    it('toDataURL should return a string', () => {
      if (!canvasSupported) return
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      ctx.fillRect(0, 0, 1, 1) // trigger command recording
      const url = canvas.toDataURL()
      expect(typeof url).toBe('string')
      expect(url.startsWith('data:')).toBe(true)
    })

    it('toBlob should invoke callback', (done) => {
      if (!canvasSupported) {
        done()
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')
      if (ctx === null) {
        done()
        return
      }
      ctx.fillRect(0, 0, 1, 1)
      canvas.toBlob((blob) => {
        expect(blob === null || blob instanceof Blob).toBe(true)
        done()
      })
    })

    describe('drawing methods and two-canvas replay', () => {
      beforeAll(() => {
        if (!canvasSupported) return
        const proto = CanvasRenderingContext2D.prototype
        /* We must capture native methods to wrap them; the patch will then wrap our wrappers. */
        /* eslint-disable @typescript-eslint/unbound-method */
        const nativeGetImageData = proto.getImageData
        const nativeFillRect = proto.fillRect
        const nativeFillText = proto.fillText
        const nativeStrokeRect = proto.strokeRect
        /* eslint-enable @typescript-eslint/unbound-method */
        proto.getImageData = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof proto.getImageData>) {
          getImageDataContexts.push(this)
          return Reflect.apply(nativeGetImageData, this, args)
        }
        proto.fillRect = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof proto.fillRect>) {
          drawCallContexts.push(this)
          return Reflect.apply(nativeFillRect, this, args)
        }
        proto.fillText = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof proto.fillText>) {
          drawCallContexts.push(this)
          return Reflect.apply(nativeFillText, this, args)
        }
        proto.strokeRect = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof proto.strokeRect>) {
          drawCallContexts.push(this)
          return Reflect.apply(nativeStrokeRect, this, args)
        }
        const canvasProto = HTMLCanvasElement.prototype
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        const nativeToDataURL = canvasProto.toDataURL
        canvasProto.toDataURL = function (this: HTMLCanvasElement, ...args: Parameters<typeof canvasProto.toDataURL>) {
          toDataURLCanvases.push(this)
          return Reflect.apply(nativeToDataURL, this, args)
        }
      })

      beforeEach(() => {
        drawCallContexts = []
        getImageDataContexts = []
        toDataURLCanvases = []
      })

      it('should create two canvases: page canvas and shadow canvas for replay', () => {
        if (!canvasSupported) return
        let canvasCreateCount = 0
        const origCreateElement = document.createElement.bind(document)
        document.createElement = (tagName: string, options?: ElementCreationOptions): HTMLElement => {
          if (tagName === 'canvas') canvasCreateCount++
          return origCreateElement(tagName, options)
        }
        const canvas = document.createElement('canvas')
        canvas.width = 10
        canvas.height = 10
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        ctx.fillRect(0, 0, 5, 5)
        canvas.toDataURL()
        document.createElement = origCreateElement
        expect(canvasCreateCount).toBe(2)
      })

      it('should replay fillRect on shadow canvas and return image data from shadow', () => {
        if (!canvasSupported) return
        const canvas = document.createElement('canvas')
        canvas.width = 4
        canvas.height = 4
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        ctx.fillStyle = 'red'
        ctx.fillRect(1, 1, 2, 2)
        const imageData = ctx.getImageData(0, 0, 4, 4)
        expect(imageData.width).toBe(4)
        expect(imageData.height).toBe(4)
        expect(imageData.data.length).toBe(4 * 4 * 4)
        expect(drawCallContexts.length).toBe(1)
        expect(drawCallContexts[0].canvas).toBe(canvas)
        expect(getImageDataContexts.length).toBe(1)
        expect(getImageDataContexts[0].canvas).not.toBe(canvas)
      })

      it('should replay fillText on shadow canvas', () => {
        if (!canvasSupported) return
        const canvas = document.createElement('canvas')
        canvas.width = 50
        canvas.height = 20
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        ctx.font = '16px sans-serif'
        ctx.fillText('Hi', 2, 14)
        const url = canvas.toDataURL()
        expect(typeof url).toBe('string')
        expect(url.startsWith('data:')).toBe(true)
        expect(drawCallContexts.length).toBe(1)
        expect(drawCallContexts[0].canvas).toBe(canvas)
        expect(toDataURLCanvases.length).toBe(1)
        expect(toDataURLCanvases[0]).not.toBe(canvas)
      })

      it('should replay strokeRect on shadow canvas', () => {
        if (!canvasSupported) return
        const canvas = document.createElement('canvas')
        canvas.width = 10
        canvas.height = 10
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        ctx.strokeRect(2, 2, 4, 4)
        const imageData = ctx.getImageData(0, 0, 10, 10)
        expect(imageData).toBeInstanceOf(ImageData)
        expect(drawCallContexts.length).toBe(1)
        expect(drawCallContexts[0].canvas).toBe(canvas)
        expect(getImageDataContexts.length).toBe(1)
        expect(getImageDataContexts[0].canvas).not.toBe(canvas)
      })

      it('should replay multiple draw commands in order before getImageData', () => {
        if (!canvasSupported) return
        const canvas = document.createElement('canvas')
        canvas.width = 20
        canvas.height = 20
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        ctx.fillStyle = 'red'
        ctx.fillRect(0, 0, 10, 10)
        ctx.fillStyle = 'green'
        ctx.fillRect(10, 0, 10, 10)
        ctx.fillStyle = 'blue'
        ctx.fillRect(0, 10, 10, 10)
        ctx.strokeStyle = 'black'
        ctx.strokeRect(10, 10, 10, 10)
        const imageData = ctx.getImageData(0, 0, 20, 20)
        expect(imageData).toBeInstanceOf(ImageData)
        expect(imageData.width).toBe(20)
        expect(imageData.height).toBe(20)
        expect(imageData.data.length).toBe(20 * 20 * 4)
        expect(drawCallContexts.length).toBe(4)
        drawCallContexts.forEach((c) => expect(c.canvas).toBe(canvas))
        expect(getImageDataContexts.length).toBe(1)
        expect(getImageDataContexts[0].canvas).not.toBe(canvas)
      })
    })
  })
})
