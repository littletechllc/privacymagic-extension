
import {describe, it, expect, beforeEach, beforeAll, afterAll, jest} from '@jest/globals'
import { enableCanvasFingerprintSpoofing } from '@src/content_scripts/patches/patch_helpers/canvas'
import { type GlobalScope } from '@src/content_scripts/helpers/globalObject'

// In jsdom without the canvas package, CanvasRenderingContext2D is undefined and enableCanvasFingerprintSpoofing(self) would throw.
const canvasSupported = typeof globalThis.CanvasRenderingContext2D !== 'undefined'
const offscreenCanvasSupported =
  canvasSupported &&
  typeof globalThis.OffscreenCanvas !== 'undefined' &&
  typeof globalThis.OffscreenCanvasRenderingContext2D !== 'undefined'

// Record which context/canvas received draw vs read calls (set up in beforeAll so patch wraps our wrappers).
let drawCallContexts: CanvasRenderingContext2D[] = []
let getImageDataContexts: CanvasRenderingContext2D[] = []
let toDataURLCanvases: HTMLCanvasElement[] = []

let offscreenDrawCallContexts: OffscreenCanvasRenderingContext2D[] = []
let offscreenGetImageDataContexts: OffscreenCanvasRenderingContext2D[] = []
let offscreenConvertToBlobCanvases: OffscreenCanvas[] = []

describe('patch_helpers/canvas', () => {
  describe('mocked 2d stack (no rasterizer)', () => {
    type CanvasMocks = {
      document: { createElement: (tag: string) => MockHTMLCanvasElement }
      CanvasRenderingContext2D: typeof MockCanvasRenderingContext2D
      HTMLCanvasElement: typeof MockHTMLCanvasElement
      OffscreenCanvas: typeof MockOffscreenCanvas
      OffscreenCanvasRenderingContext2D: typeof MockOffscreenCanvasRenderingContext2D
      ImageData: typeof MockImageData
      console: { error: ReturnType<typeof jest.fn> }
    }

    class MockImageData {
      data: Uint8ClampedArray
      width: number
      height: number
      constructor (data: Uint8ClampedArray, width: number, height: number) {
        this.data = data
        this.width = width
        this.height = height
      }
    }

    class MockCanvasRenderingContext2D {
      _canvas: MockHTMLCanvasElement
      constructor (canvas: MockHTMLCanvasElement) {
        this._canvas = canvas
      }

      fillRect (..._args: unknown[]): void {}
      getImageData (_sx: number, _sy: number, sw: number, sh: number): MockImageData {
        return new MockImageData(new Uint8ClampedArray(sw * sh * 4), sw, sh)
      }

      measureText (_text: string): TextMetrics {
        return {
          width: 12,
          actualBoundingBoxLeft: 1,
          actualBoundingBoxRight: 1,
          fontBoundingBoxAscent: 1,
          fontBoundingBoxDescent: 1,
          actualBoundingBoxAscent: 1,
          actualBoundingBoxDescent: 1,
          emHeightAscent: 1,
          emHeightDescent: 1
        } as TextMetrics
      }

      isPointInPath (..._args: unknown[]): boolean { return true }
      isPointInStroke (..._args: unknown[]): boolean { return true }
    }

    class MockOffscreenCanvasRenderingContext2D {
      _canvas: MockOffscreenCanvas
      constructor (canvas: MockOffscreenCanvas) {
        this._canvas = canvas
      }

      fillRect (..._args: unknown[]): void {}
      getImageData (_sx: number, _sy: number, sw: number, sh: number): MockImageData {
        return new MockImageData(new Uint8ClampedArray(sw * sh * 4), sw, sh)
      }

      measureText (_text: string): TextMetrics {
        return { width: 12 } as TextMetrics
      }

      isPointInPath (..._args: unknown[]): boolean { return true }
      isPointInStroke (..._args: unknown[]): boolean { return true }
    }

    class MockHTMLCanvasElement {
      _width = 0
      _height = 0
      _ctx2d: MockCanvasRenderingContext2D | null = null
      _webgl: object | null = null
      get width (): number { return this._width }
      set width (value: number) { this._width = Number(value) }
      get height (): number { return this._height }
      set height (value: number) { this._height = Number(value) }
      getContext (this: MockHTMLCanvasElement, type: string, _attrs?: unknown): unknown {
        if (type === '2d') {
          this._ctx2d ??= new MockCanvasRenderingContext2D(this)
          return this._ctx2d
        }
        if (type === 'webgl' || type === 'webgl2') {
          this._webgl ??= { isWebGL: true }
          return this._webgl
        }
        return null
      }

      toDataURL (_type?: string, _quality?: number): string {
        return 'data:image/png;base64,NATIVE'
      }

      toBlob (callback: (blob: Blob | null) => void, _type?: string, _quality?: number): void {
        callback(new Blob(['native']))
      }
    }

    class MockOffscreenCanvas {
      _width = 0
      _height = 0
      _ctx2d: MockOffscreenCanvasRenderingContext2D | null = null
      constructor (width: number, height: number) {
        this._width = width
        this._height = height
      }

      get width (): number { return this._width }
      set width (value: number) { this._width = Number(value) }
      get height (): number { return this._height }
      set height (value: number) { this._height = Number(value) }

      getContext (this: MockOffscreenCanvas, type: string, _attrs?: unknown): unknown {
        if (type === '2d') {
          this._ctx2d ??= new MockOffscreenCanvasRenderingContext2D(this)
          return this._ctx2d
        }
        return null
      }

      convertToBlob (_options?: BlobPropertyBag): Promise<Blob> {
        return Promise.resolve(new Blob(['native-offscreen']))
      }

      transferToImageBitmap (): ImageBitmap {
        return { isBitmap: true } as unknown as ImageBitmap
      }
    }

    Object.defineProperty(MockCanvasRenderingContext2D.prototype, 'canvas', {
      get (this: MockCanvasRenderingContext2D) { return this._canvas },
      configurable: true
    })
    Object.defineProperty(MockOffscreenCanvasRenderingContext2D.prototype, 'canvas', {
      get (this: MockOffscreenCanvasRenderingContext2D) { return this._canvas },
      configurable: true
    })

    /* eslint-disable @typescript-eslint/unbound-method */
    const nativeHtmlGetContext = MockHTMLCanvasElement.prototype.getContext
    const nativeOffscreenGetContext = MockOffscreenCanvas.prototype.getContext
    const nativeHtmlToBlob = MockHTMLCanvasElement.prototype.toBlob
    const nativeOffscreenTransfer = MockOffscreenCanvas.prototype.transferToImageBitmap
    const nativeIsPointInPath = MockCanvasRenderingContext2D.prototype.isPointInPath
    const nativeFillRect = MockCanvasRenderingContext2D.prototype.fillRect
    const nativeOffscreenFillRect = MockOffscreenCanvasRenderingContext2D.prototype.fillRect
    /* eslint-enable @typescript-eslint/unbound-method */

    let fillRectContexts: object[] = []
    let getContextCalls: Array<{ type: unknown, attrs: unknown, canvas: object, width: number, height: number }> = []
    let toBlobReceivers: object[] = []
    let transferReceivers: object[] = []
    let isPointInPathContexts: object[] = []
    let consoleError: ReturnType<typeof jest.fn>
    let globalObject: CanvasMocks

    const installAndPatch = (): void => {
      fillRectContexts = []
      getContextCalls = []
      toBlobReceivers = []
      transferReceivers = []
      isPointInPathContexts = []
      consoleError = jest.fn()

      MockCanvasRenderingContext2D.prototype.fillRect = function (this: MockCanvasRenderingContext2D, ...args: unknown[]) {
        fillRectContexts.push(this)
        return nativeFillRect.apply(this, args)
      }
      MockOffscreenCanvasRenderingContext2D.prototype.fillRect = function (this: MockOffscreenCanvasRenderingContext2D, ...args: unknown[]) {
        fillRectContexts.push(this)
        return nativeOffscreenFillRect.apply(this, args)
      }
      MockCanvasRenderingContext2D.prototype.isPointInPath = function (this: MockCanvasRenderingContext2D, ...args: unknown[]) {
        isPointInPathContexts.push(this)
        return nativeIsPointInPath.apply(this, args)
      }
      MockHTMLCanvasElement.prototype.getContext = function (this: MockHTMLCanvasElement, type: string, attrs?: unknown) {
        getContextCalls.push({ type, attrs, canvas: this, width: this._width, height: this._height })
        return nativeHtmlGetContext.call(this, type, attrs)
      }
      MockOffscreenCanvas.prototype.getContext = function (this: MockOffscreenCanvas, type: string, attrs?: unknown) {
        getContextCalls.push({ type, attrs, canvas: this, width: this._width, height: this._height })
        return nativeOffscreenGetContext.call(this, type, attrs)
      }
      MockHTMLCanvasElement.prototype.toBlob = function (this: MockHTMLCanvasElement, callback: (blob: Blob | null) => void, type?: string, quality?: number) {
        toBlobReceivers.push(this)
        return nativeHtmlToBlob.call(this, callback, type, quality)
      }
      MockOffscreenCanvas.prototype.transferToImageBitmap = function (this: MockOffscreenCanvas) {
        transferReceivers.push(this)
        return nativeOffscreenTransfer.call(this)
      }

      globalObject = {
        document: {
          createElement: (tag: string) => {
            if (tag !== 'canvas') throw new Error(`unexpected tag ${tag}`)
            return new MockHTMLCanvasElement()
          }
        },
        CanvasRenderingContext2D: MockCanvasRenderingContext2D,
        HTMLCanvasElement: MockHTMLCanvasElement,
        OffscreenCanvas: MockOffscreenCanvas,
        OffscreenCanvasRenderingContext2D: MockOffscreenCanvasRenderingContext2D,
        ImageData: MockImageData,
        console: { error: consoleError }
      }
      enableCanvasFingerprintSpoofing(globalObject as unknown as GlobalScope)
    }

    beforeEach(() => {
      installAndPatch()
    })

    it('should no-op when document is null', () => {
      expect(() => enableCanvasFingerprintSpoofing({ document: null } as unknown as GlobalScope)).not.toThrow()
    })

    it('should throw when the canvas getter is missing', () => {
      class NoCanvasGetter {
        fillRect (): void {}
        getImageData (): MockImageData { return new MockImageData(new Uint8ClampedArray(0), 0, 0) }
        measureText (): TextMetrics { return { width: 0 } as TextMetrics }
        isPointInPath (): boolean { return false }
        isPointInStroke (): boolean { return false }
      }
      const broken = {
        document: { createElement: () => new MockHTMLCanvasElement() },
        CanvasRenderingContext2D: NoCanvasGetter,
        HTMLCanvasElement: MockHTMLCanvasElement,
        OffscreenCanvas: MockOffscreenCanvas,
        OffscreenCanvasRenderingContext2D: MockOffscreenCanvasRenderingContext2D,
        ImageData: MockImageData,
        console: { error: jest.fn() }
      } as unknown as GlobalScope
      expect(() => enableCanvasFingerprintSpoofing(broken)).toThrow('canvas getter not found')
    })

    it('should keep HTML canvas width and height getters working and size the shadow canvas', () => {
      const canvas = globalObject.document.createElement('canvas')
      canvas.width = 4
      canvas.height = 4
      const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D
      ctx.fillRect(0, 0, 4, 4)
      canvas.width = 8
      canvas.height = 6
      expect(canvas.width).toBe(8)
      expect(canvas.height).toBe(6)
      ctx.getImageData(0, 0, 8, 6)
      const shadowGetContext = getContextCalls.find((call) =>
        call.canvas !== canvas && call.type === '2d'
      )
      expect(shadowGetContext).toBeDefined()
      expect(shadowGetContext!.width).toBe(8)
      expect(shadowGetContext!.height).toBe(6)
    })

    it('should keep OffscreenCanvas height in sync with the recorder', () => {
      const canvas = new globalObject.OffscreenCanvas(4, 4)
      const ctx = canvas.getContext('2d') as MockOffscreenCanvasRenderingContext2D
      ctx.fillRect(0, 0, 4, 4)
      canvas.height = 8
      expect(canvas.height).toBe(8)
      ctx.getImageData(0, 0, 4, 8)
      const shadowGetContext = getContextCalls.find((call) =>
        call.canvas !== canvas && call.type === '2d'
      )
      expect(shadowGetContext).toBeDefined()
      expect(shadowGetContext!.height).toBe(8)
    })

    it('should drop drawing commands older than 250ms before replay', () => {
      let now = 1_000_000
      const spy = jest.spyOn(Date, 'now').mockImplementation(() => now)
      try {
        const canvas = globalObject.document.createElement('canvas')
        canvas.width = 10
        canvas.height = 10
        const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D
        ctx.fillRect(0, 0, 5, 5)
        now += 251
        ctx.fillRect(5, 5, 5, 5)
        ctx.getImageData(0, 0, 10, 10)
        const shadowFills = fillRectContexts.filter((context) => context !== ctx)
        expect(shadowFills).toHaveLength(1)
      } finally {
        spy.mockRestore()
      }
    })

    it('should use empty/zero/false read fallbacks when there is no command recorder', () => {
      const canvas = new globalObject.HTMLCanvasElement()
      canvas.width = 4
      canvas.height = 4
      const ctx = nativeHtmlGetContext.call(canvas, '2d') as MockCanvasRenderingContext2D
      const imageData = ctx.getImageData(0, 0, 4, 4)
      expect(imageData.width).toBe(4)
      expect(imageData.height).toBe(4)
      expect(imageData.data.every((byte) => byte === 0)).toBe(true)
      expect(ctx.measureText('WWWW').width).toBe(0)
      expect(ctx.isPointInPath(1, 1)).toBe(false)
      expect(ctx.isPointInStroke(1, 1)).toBe(false)
    })

    it('should invoke isPointInPath on the shadow context when a recorder exists', () => {
      const canvas = globalObject.document.createElement('canvas')
      const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D
      ctx.fillRect(0, 0, 1, 1)
      expect(ctx.isPointInPath(0, 0)).toBe(true)
      expect(isPointInPathContexts).toHaveLength(1)
      expect(isPointInPathContexts[0]).not.toBe(ctx)
    })

    it('should read toBlob from the shadow canvas', (done) => {
      const canvas = globalObject.document.createElement('canvas')
      const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D
      ctx.fillRect(0, 0, 1, 1)
      canvas.toBlob((blob) => {
        expect(blob).toBeInstanceOf(Blob)
        expect(toBlobReceivers).toHaveLength(1)
        expect(toBlobReceivers[0]).not.toBe(canvas)
        done()
      })
    })

    it('should transferToImageBitmap from the shadow OffscreenCanvas', () => {
      const canvas = new globalObject.OffscreenCanvas(1, 1)
      const ctx = canvas.getContext('2d') as MockOffscreenCanvasRenderingContext2D
      ctx.fillRect(0, 0, 1, 1)
      const bitmap = canvas.transferToImageBitmap()
      expect(bitmap).toEqual({ isBitmap: true })
      expect(transferReceivers).toHaveLength(1)
      expect(transferReceivers[0]).not.toBe(canvas)
    })

    it('should reuse the command recorder on a second getContext("2d")', () => {
      const canvas = globalObject.document.createElement('canvas')
      const ctx1 = canvas.getContext('2d') as MockCanvasRenderingContext2D
      ctx1.fillRect(0, 0, 1, 1)
      const ctx2 = canvas.getContext('2d') as MockCanvasRenderingContext2D
      expect(ctx2).toBe(ctx1)
      ctx2.getImageData(0, 0, 1, 1)
      const shadowFills = fillRectContexts.filter((context) => context !== ctx1)
      expect(shadowFills).toHaveLength(1)
    })

    it('should fall through to native toDataURL after getContext("webgl")', () => {
      const canvas = globalObject.document.createElement('canvas')
      expect(canvas.getContext('webgl')).toEqual({ isWebGL: true })
      expect(canvas.toDataURL()).toBe('data:image/png;base64,NATIVE')
    })

    it('should create the shadow 2d context with willReadFrequently', () => {
      const canvas = globalObject.document.createElement('canvas')
      canvas.getContext('2d', { alpha: false })
      const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D
      ctx.fillRect(0, 0, 1, 1)
      canvas.toDataURL()
      const shadowGetContext = getContextCalls.find((call) =>
        call.canvas !== canvas && call.type === '2d'
      )
      expect(shadowGetContext?.attrs).toEqual({ alpha: false, willReadFrequently: true })
    })

    it('should swallow command replay errors and still return ImageData', () => {
      MockCanvasRenderingContext2D.prototype.fillRect = function (this: MockCanvasRenderingContext2D) {
        fillRectContexts.push(this)
        if (fillRectContexts.length >= 2) {
          throw new Error('replay fail')
        }
      }
      enableCanvasFingerprintSpoofing(globalObject as unknown as GlobalScope)

      const canvas = globalObject.document.createElement('canvas')
      const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D
      ctx.fillRect(0, 0, 1, 1)
      const imageData = ctx.getImageData(0, 0, 1, 1)
      expect(imageData).toBeInstanceOf(MockImageData)
      expect(consoleError).toHaveBeenCalled()
    })
  })

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
      enableCanvasFingerprintSpoofing(self)
    })

    it('should not throw when applied', () => {
      if (!canvasSupported) return
      expect(() => enableCanvasFingerprintSpoofing(self)).not.toThrow()
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

    describe('non-2d canvas export', () => {
      const distinctiveDataUrl = 'data:image/png;base64,NATIVE'
      let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL
      let originalToBlob: typeof HTMLCanvasElement.prototype.toBlob

      beforeAll(() => {
        if (!canvasSupported) return
        const proto = HTMLCanvasElement.prototype
        /* eslint-disable @typescript-eslint/unbound-method */
        originalToDataURL = proto.toDataURL
        originalToBlob = proto.toBlob
        /* eslint-enable @typescript-eslint/unbound-method */
        proto.toDataURL = function () { return distinctiveDataUrl }
        proto.toBlob = function (callback: BlobCallback) {
          callback(new Blob(['native']))
        }
      })

      afterAll(() => {
        if (!canvasSupported) return
        HTMLCanvasElement.prototype.toDataURL = originalToDataURL
        HTMLCanvasElement.prototype.toBlob = originalToBlob
      })

      it('toDataURL without a 2d context should fall through to native', () => {
        if (!canvasSupported) return
        const canvas = document.createElement('canvas')
        expect(canvas.toDataURL()).toBe(distinctiveDataUrl)
      })

      it('toBlob without a 2d context should fall through to native', (done) => {
        if (!canvasSupported) {
          done()
          return
        }
        const canvas = document.createElement('canvas')
        canvas.toBlob((blob) => {
          expect(blob).toBeInstanceOf(Blob)
          done()
        })
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

  describe('OffscreenCanvas', () => {
    const getOffscreen2dContext = (): OffscreenCanvasRenderingContext2D | null => {
      try {
        const canvas = new OffscreenCanvas(1, 1)
        return canvas.getContext('2d')
      } catch {
        return null
      }
    }

    describe('enableCanvasFingerprintSpoofing', () => {
      beforeEach(() => {
        if (!offscreenCanvasSupported) return
        enableCanvasFingerprintSpoofing(self)
      })

      it('should not throw when applied', () => {
        if (!offscreenCanvasSupported) return
        expect(() => enableCanvasFingerprintSpoofing(self)).not.toThrow()
      })

      it('getContext("2d") should return a context when supported', () => {
        if (!offscreenCanvasSupported) return
        const canvas = new OffscreenCanvas(1, 1)
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        expect(ctx).toBeDefined()
        expect(ctx.canvas).toBe(canvas)
      })

      it('measureText should return a TextMetrics-like object', () => {
        if (!offscreenCanvasSupported) return
        const ctx = getOffscreen2dContext()
        if (ctx === null) return
        const metrics = ctx.measureText('test')
        expect(metrics).toBeDefined()
        expect(typeof metrics.width).toBe('number')
      })

      it('getImageData should return ImageData with correct dimensions', () => {
        if (!offscreenCanvasSupported) return
        const ctx = getOffscreen2dContext()
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
        if (!offscreenCanvasSupported) return
        const ctx = getOffscreen2dContext()
        if (ctx === null) return
        expect(typeof ctx.isPointInPath(0, 0)).toBe('boolean')
        expect(typeof ctx.isPointInStroke(0, 0)).toBe('boolean')
      })

      it('convertToBlob should resolve to Blob or null', async () => {
        if (!offscreenCanvasSupported) return
        const canvas = new OffscreenCanvas(1, 1)
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        ctx.fillRect(0, 0, 1, 1)
        const blob = await canvas.convertToBlob()
        expect(blob === null || blob instanceof Blob).toBe(true)
      })

      it('transferToImageBitmap should return ImageBitmap or null', () => {
        if (!offscreenCanvasSupported) return
        const canvas = new OffscreenCanvas(1, 1)
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        ctx.fillRect(0, 0, 1, 1)
        const bitmap = canvas.transferToImageBitmap()
        expect(bitmap === null || bitmap instanceof ImageBitmap).toBe(true)
      })

      describe('non-2d OffscreenCanvas export', () => {
        const nativeBlob = new Blob(['native-offscreen'])
        const nativeBitmap = {} as ImageBitmap
        let originalConvertToBlob: typeof OffscreenCanvas.prototype.convertToBlob
        let originalTransferToImageBitmap: typeof OffscreenCanvas.prototype.transferToImageBitmap

        beforeAll(() => {
          if (!offscreenCanvasSupported) return
          const proto = OffscreenCanvas.prototype
          /* eslint-disable @typescript-eslint/unbound-method */
          originalConvertToBlob = proto.convertToBlob
          originalTransferToImageBitmap = proto.transferToImageBitmap
          /* eslint-enable @typescript-eslint/unbound-method */
          proto.convertToBlob = function () { return Promise.resolve(nativeBlob) }
          proto.transferToImageBitmap = function () { return nativeBitmap }
        })

        afterAll(() => {
          if (!offscreenCanvasSupported) return
          OffscreenCanvas.prototype.convertToBlob = originalConvertToBlob
          OffscreenCanvas.prototype.transferToImageBitmap = originalTransferToImageBitmap
        })

        it('convertToBlob without a 2d context should fall through to native', async () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(1, 1)
          await expect(canvas.convertToBlob()).resolves.toBe(nativeBlob)
        })

        it('transferToImageBitmap without a 2d context should fall through to native', () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(1, 1)
          expect(canvas.transferToImageBitmap()).toBe(nativeBitmap)
        })
      })

      describe('drawing methods and two-canvas replay', () => {
        const OriginalOffscreenCanvas = globalThis.OffscreenCanvas
        let offscreenCanvasCreateCount = 0

        beforeAll(() => {
          if (!offscreenCanvasSupported) return
          globalThis.OffscreenCanvas = class extends OriginalOffscreenCanvas {
            constructor (width: number, height: number) {
              super(width, height)
              offscreenCanvasCreateCount++
            }
          }

          const proto = OffscreenCanvasRenderingContext2D.prototype
          /* We must capture native methods to wrap them; the patch will then wrap our wrappers. */
          /* eslint-disable @typescript-eslint/unbound-method */
          const nativeGetImageData = proto.getImageData
          const nativeFillRect = proto.fillRect
          const nativeFillText = proto.fillText
          const nativeStrokeRect = proto.strokeRect
          /* eslint-enable @typescript-eslint/unbound-method */
          proto.getImageData = function (this: OffscreenCanvasRenderingContext2D, ...args: Parameters<typeof proto.getImageData>) {
            offscreenGetImageDataContexts.push(this)
            return Reflect.apply(nativeGetImageData, this, args)
          }
          proto.fillRect = function (this: OffscreenCanvasRenderingContext2D, ...args: Parameters<typeof proto.fillRect>) {
            offscreenDrawCallContexts.push(this)
            return Reflect.apply(nativeFillRect, this, args)
          }
          proto.fillText = function (this: OffscreenCanvasRenderingContext2D, ...args: Parameters<typeof proto.fillText>) {
            offscreenDrawCallContexts.push(this)
            return Reflect.apply(nativeFillText, this, args)
          }
          proto.strokeRect = function (this: OffscreenCanvasRenderingContext2D, ...args: Parameters<typeof proto.strokeRect>) {
            offscreenDrawCallContexts.push(this)
            return Reflect.apply(nativeStrokeRect, this, args)
          }
          const offscreenProto = OffscreenCanvas.prototype
          /* eslint-disable-next-line @typescript-eslint/unbound-method */
          const nativeConvertToBlob = offscreenProto.convertToBlob
          offscreenProto.convertToBlob = function (this: OffscreenCanvas, ...args: Parameters<typeof offscreenProto.convertToBlob>) {
            offscreenConvertToBlobCanvases.push(this)
            return Reflect.apply(nativeConvertToBlob, this, args)
          }
        })

        afterAll(() => {
          if (!offscreenCanvasSupported) return
          globalThis.OffscreenCanvas = OriginalOffscreenCanvas
        })

        beforeEach(() => {
          offscreenDrawCallContexts = []
          offscreenGetImageDataContexts = []
          offscreenConvertToBlobCanvases = []
          offscreenCanvasCreateCount = 0
        })

        it('should create two offscreen canvases: page canvas and shadow canvas for replay', async () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(10, 10)
          const ctx = canvas.getContext('2d')
          if (ctx === null) return
          ctx.fillRect(0, 0, 5, 5)
          await canvas.convertToBlob()
          expect(offscreenCanvasCreateCount).toBe(2)
        })

        it('should replay fillRect on shadow canvas and return image data from shadow', () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(4, 4)
          const ctx = canvas.getContext('2d')
          if (ctx === null) return
          ctx.fillStyle = 'red'
          ctx.fillRect(1, 1, 2, 2)
          const imageData = ctx.getImageData(0, 0, 4, 4)
          expect(imageData.width).toBe(4)
          expect(imageData.height).toBe(4)
          expect(imageData.data.length).toBe(4 * 4 * 4)
          expect(offscreenDrawCallContexts.length).toBe(1)
          expect(offscreenDrawCallContexts[0].canvas).toBe(canvas)
          expect(offscreenGetImageDataContexts.length).toBe(1)
          expect(offscreenGetImageDataContexts[0].canvas).not.toBe(canvas)
        })

        it('should replay fillText on shadow canvas', async () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(50, 20)
          const ctx = canvas.getContext('2d')
          if (ctx === null) return
          ctx.font = '16px sans-serif'
          ctx.fillText('Hi', 2, 14)
          await canvas.convertToBlob()
          expect(offscreenDrawCallContexts.length).toBe(1)
          expect(offscreenDrawCallContexts[0].canvas).toBe(canvas)
          expect(offscreenConvertToBlobCanvases.length).toBe(1)
          expect(offscreenConvertToBlobCanvases[0]).not.toBe(canvas)
        })

        it('should replay strokeRect on shadow canvas', () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(10, 10)
          const ctx = canvas.getContext('2d')
          if (ctx === null) return
          ctx.strokeRect(2, 2, 4, 4)
          const imageData = ctx.getImageData(0, 0, 10, 10)
          expect(imageData).toBeInstanceOf(ImageData)
          expect(offscreenDrawCallContexts.length).toBe(1)
          expect(offscreenDrawCallContexts[0].canvas).toBe(canvas)
          expect(offscreenGetImageDataContexts.length).toBe(1)
          expect(offscreenGetImageDataContexts[0].canvas).not.toBe(canvas)
        })

        it('should replay multiple draw commands in order before getImageData', () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(20, 20)
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
          expect(offscreenDrawCallContexts.length).toBe(4)
          offscreenDrawCallContexts.forEach((c) => expect(c.canvas).toBe(canvas))
          expect(offscreenGetImageDataContexts.length).toBe(1)
          expect(offscreenGetImageDataContexts[0].canvas).not.toBe(canvas)
        })

        it('should keep recorder dimensions in sync when width is changed after getContext', () => {
          if (!offscreenCanvasSupported) return
          const canvas = new OffscreenCanvas(4, 4)
          const ctx = canvas.getContext('2d')
          if (ctx === null) return
          ctx.fillRect(0, 0, 4, 4)
          canvas.width = 8
          const imageData = ctx.getImageData(0, 0, 8, 4)
          expect(imageData.width).toBe(8)
          expect(imageData.height).toBe(4)
        })
      })
    })
  })
})
