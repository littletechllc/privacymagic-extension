import { createSafeSetter, redefineMethods, reflectApplySafe, reflectConstructSafe, objectDefinePropertiesSafe, createSafeMethod, createSafeGetter, objectGetOwnPropertyDescriptorsSafe } from '@src/content_scripts/helpers/monkey-patch'
import { weakMapGetSafe, weakMapHasSafe, weakMapSetSafe } from '@src/content_scripts/helpers/safe'
import { GlobalScope } from '../../helpers/globalObject'

export const enableCanvasFingerprintSpoofing = (globalObject: GlobalScope): void => {
  const doc = globalObject.document
  if (doc == null) return
  const canvasDescriptor = Object.getOwnPropertyDescriptor(globalObject.CanvasRenderingContext2D.prototype, 'canvas')
  if (canvasDescriptor?.get === undefined) {
    throw new Error('canvas getter not found')
  }
  const originalCanvasFromContextSafe = createSafeGetter(globalObject.CanvasRenderingContext2D, 'canvas')
  const originalCanvasGetContextSafe = createSafeMethod(globalObject.HTMLCanvasElement, 'getContext')
  const originalCanvasToDataURLSafe = createSafeMethod(globalObject.HTMLCanvasElement, 'toDataURL')
  const originalCanvasToBlobSafe = createSafeMethod(globalObject.HTMLCanvasElement, 'toBlob')
  const originalContextGetImageDataSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'getImageData')
  const originalContextMeasureTextSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'measureText')
  const originalContextIsPointInPathSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'isPointInPath')
  const originalContextIsPointInStrokeSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'isPointInStroke')

  const originalOffscreenCanvasFromContextSafe = createSafeGetter(globalObject.OffscreenCanvasRenderingContext2D, 'canvas')
  const originalOffscreenCanvasGetContextSafe = createSafeMethod(globalObject.OffscreenCanvas, 'getContext')
  const originalOffscreenCanvasTransferToImageBitmapSafe = createSafeMethod(globalObject.OffscreenCanvas, 'transferToImageBitmap')
  const originalOffscreenCanvasContextGetImageDataSafe = createSafeMethod(globalObject.OffscreenCanvasRenderingContext2D, 'getImageData')
  const originalOffscreenCanvasConvertToBlobSafe = createSafeMethod(globalObject.OffscreenCanvas, 'convertToBlob')
  const originalOffscreenCanvasContextMeasureTextSafe = createSafeMethod(globalObject.OffscreenCanvasRenderingContext2D, 'measureText')
  const originalOffscreenCanvasContextIsPointInPathSafe = createSafeMethod(globalObject.OffscreenCanvasRenderingContext2D, 'isPointInPath')
  const originalOffscreenCanvasContextIsPointInStrokeSafe = createSafeMethod(globalObject.OffscreenCanvasRenderingContext2D, 'isPointInStroke')

  const originalCanvasSetWidthSafe = createSafeSetter(globalObject.HTMLCanvasElement, 'width')
  const originalCanvasSetHeightSafe = createSafeSetter(globalObject.HTMLCanvasElement, 'height')
  const originalOffscreenCanvasSetWidthSafe = createSafeSetter(globalObject.OffscreenCanvas, 'width')
  const originalOffscreenCanvasSetHeightSafe = createSafeSetter(globalObject.OffscreenCanvas, 'height')

  const originalContextDescriptors = objectGetOwnPropertyDescriptorsSafe(globalObject.CanvasRenderingContext2D.prototype)
  const originalOffscreenContextDescriptors = objectGetOwnPropertyDescriptorsSafe(globalObject.OffscreenCanvasRenderingContext2D.prototype)

  const createInvisibleCanvas = (width: number, height: number): HTMLCanvasElement => {
    const shadowCanvas = doc.createElement('canvas')
    shadowCanvas.width = width
    shadowCanvas.height = height
    return shadowCanvas
  }

  const createShadowOffscreenCanvas = (width: number, height: number): OffscreenCanvas => {
    const shadowCanvas = new globalObject.OffscreenCanvas(width, height)
    return shadowCanvas
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type CommandArgs = any[]

  type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

  // `Parameters<>` only reflects the last overload; these unions match lib.dom.d.ts.
  type CanvasIsPointInPathArgs =
    | [x: number, y: number, fillRule?: CanvasFillRule]
    | [path: Path2D, x: number, y: number, fillRule?: CanvasFillRule]
  type CanvasIsPointInStrokeArgs =
    | [x: number, y: number]
    | [path: Path2D, x: number, y: number]

  type CommandType = 'call' | 'set'

  interface Command {
    name: string
    args: CommandArgs
    type: CommandType
    timestamp: number
  }

  class CommandRecorder {
    commands: Command[] = []
    contextAttributes = {}
    shadowCanvas: HTMLCanvasElement | OffscreenCanvas | undefined
    shadowContext: Context2D | null = null
    width: number = 0
    height: number = 0
    offscreen: boolean = false

    constructor (contextAttributes: CanvasRenderingContext2DSettings, width: number, height: number, offscreen: boolean) {
      this.contextAttributes = contextAttributes
      this.width = width
      this.height = height
      this.offscreen = offscreen
    }

    recordCommand (name: string, args: CommandArgs, type: CommandType): void {
      const timestamp = Date.now()
      if (this.commands.length > 0 && this.commands[this.commands.length - 1].timestamp < timestamp - 250) {
        this.commands = []
        this.wipeShadowCanvas()
      }
      this.commands.push({ name, args, type, timestamp })
    }

    replayCommands (): Context2D {
      if (this.shadowContext == null) {
        this.createShadowContext()
      }
      if (this.shadowContext == null) {
        throw new Error('Shadow context not created')
      }
      for (const command of this.commands) {
        const descriptor = this.offscreen ? originalOffscreenContextDescriptors[command.name] : originalContextDescriptors[command.name]
        const property = command.type === 'call' ? 'value' : 'set'
        const fn: unknown = descriptor?.[property]
        if (typeof fn !== 'function') {
          continue
        }
        try {
          reflectApplySafe(fn as (...args: unknown[]) => unknown, this.shadowContext, command.args)
        } catch (error) {
          globalObject.console.error('Error replaying command:', command.type, command.name, command.args, error)
        }
      }
      this.commands = []
      return this.shadowContext
    }

    createShadowContext (): void {
      if (this.offscreen) {
        this.shadowCanvas = createShadowOffscreenCanvas(this.width, this.height)
        this.shadowContext = originalOffscreenCanvasGetContextSafe(this.shadowCanvas, '2d', { ...this.contextAttributes, willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | null
      } else {
        this.shadowCanvas = createInvisibleCanvas(this.width, this.height)
        this.shadowContext = originalCanvasGetContextSafe(this.shadowCanvas, '2d', { ...this.contextAttributes, willReadFrequently: true }) as CanvasRenderingContext2D | null
      }
    }

    wipeShadowCanvas (): void {
      if (this.shadowCanvas != null) {
        this.shadowCanvas.width = this.width
      }
    }

    context2dGetImageData (...args: Parameters<typeof globalObject.CanvasRenderingContext2D.prototype.getImageData>): ImageData {
      const context = this.replayCommands()
      if (context instanceof globalObject.CanvasRenderingContext2D) {
        return originalContextGetImageDataSafe(context, ...args)
      }
      if (context instanceof globalObject.OffscreenCanvasRenderingContext2D) {
        return originalOffscreenCanvasContextGetImageDataSafe(context, ...args)
      }
      return new globalObject.ImageData(new Uint8ClampedArray(0), 0, 0)
    }

    context2dMeasureText (...args: Parameters<typeof globalObject.CanvasRenderingContext2D.prototype.measureText>): TextMetrics {
      const context = this.replayCommands()
      if (context instanceof globalObject.CanvasRenderingContext2D) {
        return originalContextMeasureTextSafe(context, ...args)
      } else if (context instanceof globalObject.OffscreenCanvasRenderingContext2D) {
        return originalOffscreenCanvasContextMeasureTextSafe(context, ...args)
      } else {
        throw new Error('Invalid context')
      }
    }

    context2dIsPointInPath (...args: CanvasIsPointInPathArgs): boolean {
      const context = this.replayCommands()
      if (context instanceof globalObject.CanvasRenderingContext2D) {
        return originalContextIsPointInPathSafe(context, ...(args as Parameters<CanvasRenderingContext2D['isPointInPath']>))
      }
      if (context instanceof globalObject.OffscreenCanvasRenderingContext2D) {
        return originalOffscreenCanvasContextIsPointInPathSafe(context, ...(args as Parameters<OffscreenCanvasRenderingContext2D['isPointInPath']>))
      }
      return false
    }

    context2dIsPointInStroke (...args: CanvasIsPointInStrokeArgs): boolean {
      const context = this.replayCommands()
      if (context instanceof globalObject.CanvasRenderingContext2D) {
        return originalContextIsPointInStrokeSafe(context, ...(args as Parameters<CanvasRenderingContext2D['isPointInStroke']>))
      }
      if (context instanceof globalObject.OffscreenCanvasRenderingContext2D) {
        return originalOffscreenCanvasContextIsPointInStrokeSafe(context, ...(args as Parameters<OffscreenCanvasRenderingContext2D['isPointInStroke']>))
      }
      return false
    }

    canvasToDataURL (type: string, quality: number): string {
      const shadowContext = this.replayCommands()
      if (shadowContext == null || !(shadowContext instanceof globalObject.CanvasRenderingContext2D)) {
        return 'data:,'
      }
      const shadowCanvas = originalCanvasFromContextSafe(shadowContext)
      return originalCanvasToDataURLSafe(shadowCanvas, type, quality)
    }

    canvasToBlob (callback: (blob: Blob | null) => void, type: string, quality: number): void {
      const shadowContext = this.replayCommands()
      if (shadowContext == null || !(shadowContext instanceof globalObject.CanvasRenderingContext2D)) {
        callback(null)
        return
      }
      const shadowCanvas = originalCanvasFromContextSafe(shadowContext)
      return originalCanvasToBlobSafe(shadowCanvas, callback, type, quality)
    }

    offscreenCanvasConvertToBlob (options: BlobPropertyBag): Promise<Blob | null> {
      const shadowContext = this.replayCommands()
      if (shadowContext == null || !(shadowContext instanceof globalObject.OffscreenCanvasRenderingContext2D)) {
        return Promise.resolve(null)
      }
      const shadowCanvas = originalOffscreenCanvasFromContextSafe(shadowContext)
      return originalOffscreenCanvasConvertToBlobSafe(shadowCanvas, options)
    }

    offscreenCanvasTransferToImageBitmap (): ImageBitmap | null {
      const shadowContext = this.replayCommands()
      if (shadowContext == null || !(shadowContext instanceof globalObject.OffscreenCanvasRenderingContext2D)) {
        return null
      }
      const shadowCanvas = originalOffscreenCanvasFromContextSafe(shadowContext)
      return originalOffscreenCanvasTransferToImageBitmapSafe(shadowCanvas)
    }

    setWidth (value: number): void {
      this.width = value
      if (this.shadowCanvas != null) {
        this.shadowCanvas.width = value
      }
    }

    setHeight (value: number): void {
      this.height = value
      if (this.shadowCanvas != null) {
        this.shadowCanvas.height = value
      }
    }
  }

  const canvasToCommandRecorder = new WeakMap<HTMLCanvasElement | OffscreenCanvas, CommandRecorder>()

  const getCommandRecorderForContext = (context: Context2D): CommandRecorder | undefined => {
    let canvas: HTMLCanvasElement | OffscreenCanvas
    if (context instanceof globalObject.CanvasRenderingContext2D) {
      canvas = originalCanvasFromContextSafe(context)
    } else if (context instanceof globalObject.OffscreenCanvasRenderingContext2D) {
      canvas = originalOffscreenCanvasFromContextSafe(context)
    } else {
      throw new Error('Invalid context')
    }
    return weakMapGetSafe(canvasToCommandRecorder, canvas)
  }

  const createOrGetCommandRecorder = (canvas: HTMLCanvasElement | OffscreenCanvas, contextAttributes: CanvasRenderingContext2DSettings): CommandRecorder => {
    const existing = weakMapGetSafe(canvasToCommandRecorder, canvas)
    if (existing !== undefined) {
      return existing
    }
    const offscreen: boolean = canvas instanceof globalObject.OffscreenCanvas
    const commandRecorder = reflectConstructSafe(CommandRecorder, [contextAttributes ?? {}, canvas.width, canvas.height, offscreen])
    weakMapSetSafe(canvasToCommandRecorder, canvas, commandRecorder)
    return commandRecorder
  }

  const nonDrawingCommands = ['canvas', 'getImageData', 'measureText', 'isPointInPath', 'isPointInStroke']

  const enableContext2dCommandRecording = (context2d: typeof globalObject.CanvasRenderingContext2D | typeof globalObject.OffscreenCanvasRenderingContext2D): void => {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(context2d.prototype))) {
      if (nonDrawingCommands.includes(name)) {
        continue
      }
      const newDescriptor = { ...descriptor }
      if (descriptor.value !== undefined) {
        const originalValue = descriptor.value as (...a: unknown[]) => unknown
        newDescriptor.value = function (this: Context2D, ...args: Parameters<typeof descriptor.value>) {
          const commandRecorder = getCommandRecorderForContext(this)
          if (commandRecorder !== undefined) {
            commandRecorder.recordCommand(name, args, 'call')
          }
          return reflectApplySafe(originalValue, this, args)
        }
      } else if (descriptor.set !== undefined) {
        const originalSet = descriptor.set as (...a: unknown[]) => void
        newDescriptor.set = function (this: Context2D, ...args: Parameters<typeof descriptor.set>) {
          const commandRecorder = getCommandRecorderForContext(this)
          if (commandRecorder !== undefined) {
            commandRecorder.recordCommand(name, args, 'set')
          }
          reflectApplySafe(originalSet, this, args)
        }
      }
      Object.defineProperty(context2d.prototype, name, newDescriptor)
    }
  }

  const enableReadingFromContext2dCommandRecorder = (context2d: typeof globalObject.CanvasRenderingContext2D | typeof globalObject.OffscreenCanvasRenderingContext2D): void => {
    redefineMethods(context2d.prototype, {
      getImageData: function (this: Context2D, sx: number, sy: number, sw: number, sh: number, settings: ImageDataSettings) {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dGetImageData(sx, sy, sw, sh, settings)
        } else {
          const data = new Uint8ClampedArray(sw * sh * 4)
          return new globalObject.ImageData(data, sw, sh)
        }
      },
      measureText: function (this: Context2D, ...args: Parameters<typeof globalObject.CanvasRenderingContext2D.prototype.measureText>) {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dMeasureText(...args)
        } else {
          return {
            width: 0,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: 0,
            fontBoundingBoxAscent: 0,
            fontBoundingBoxDescent: 0,
            actualBoundingBoxAscent: 0,
            actualBoundingBoxDescent: 0,
            emHeightAscent: 0,
            emHeightDescent: 0
          }
        }
      },
      isPointInPath: (function (
        this: Context2D,
        ...args: CanvasIsPointInPathArgs
      ): boolean {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dIsPointInPath(...args)
        }
        return false
      }) as CanvasRenderingContext2D['isPointInPath'],
      isPointInStroke: (function (
        this: Context2D,
        ...args: CanvasIsPointInStrokeArgs
      ): boolean {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dIsPointInStroke(...args)
        }
        return false
      }) as CanvasRenderingContext2D['isPointInStroke']
    })
  }

  const enableCanvasCommandRecording = (): void => {
    redefineMethods(globalObject.HTMLCanvasElement.prototype, {
      getContext: function (this: HTMLCanvasElement, contextType: string, contextAttributes: CanvasRenderingContext2DSettings) {
        const context = originalCanvasGetContextSafe(this, contextType, contextAttributes)
        if (context != null && contextType === '2d') {
          createOrGetCommandRecorder(this, contextAttributes)
        }
        return context
      },
      toDataURL: function (this: HTMLCanvasElement, type: string, quality: number) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this)!.canvasToDataURL(type, quality)
        }
        return 'data:,'
      },
      toBlob: function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void, type: string, quality: number) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this)!.canvasToBlob(callback, type, quality)
        }
        globalObject.setTimeout(() => callback(null), 0)
      }
    })
    objectDefinePropertiesSafe(globalObject.HTMLCanvasElement.prototype, {
      width: {
        set: function (this: HTMLCanvasElement, value: number) {
          originalCanvasSetWidthSafe(this, value)
          if (weakMapHasSafe(canvasToCommandRecorder, this)) {
            weakMapGetSafe(canvasToCommandRecorder, this)!.setWidth(value)
          }
        }
      },
      height: {
        set: function (this: HTMLCanvasElement, value: number) {
          originalCanvasSetHeightSafe(this, value)
          if (weakMapHasSafe(canvasToCommandRecorder, this)) {
            weakMapGetSafe(canvasToCommandRecorder, this)!.setHeight(value)
          }
        }
      }
    })
  }

  const enableOffscreenCanvasCommandRecording = (): void => {
    redefineMethods(globalObject.OffscreenCanvas.prototype, {
      getContext: function (this: OffscreenCanvas, contextType: OffscreenRenderingContextId, contextAttributes: CanvasRenderingContext2DSettings) {
        const context = originalOffscreenCanvasGetContextSafe(this, contextType, contextAttributes)
        if (context != null && contextType === '2d') {
          createOrGetCommandRecorder(this, contextAttributes)
        }
        return context
      },
      convertToBlob: function (this: OffscreenCanvas, options: BlobPropertyBag) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this)!.offscreenCanvasConvertToBlob(options)
        }
        return Promise.resolve(null)
      },
      transferToImageBitmap: function (this: OffscreenCanvas) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this)!.offscreenCanvasTransferToImageBitmap()
        }
        return null
      }
    })
    objectDefinePropertiesSafe(globalObject.OffscreenCanvas.prototype, {
      width: {
        set: function (this: OffscreenCanvas, value: number) {
          originalOffscreenCanvasSetWidthSafe(this, value)
          if (weakMapHasSafe(canvasToCommandRecorder, this)) {
            weakMapGetSafe(canvasToCommandRecorder, this)!.setWidth(value)
          }
        }
      },
      height: {
        set: function (this: OffscreenCanvas, value: number) {
          originalOffscreenCanvasSetHeightSafe(this, value)
          if (weakMapHasSafe(canvasToCommandRecorder, this)) {
            weakMapGetSafe(canvasToCommandRecorder, this)!.setHeight(value)
          }
        }
      }
    })
  }

  enableContext2dCommandRecording(globalObject.CanvasRenderingContext2D)
  enableReadingFromContext2dCommandRecorder(globalObject.CanvasRenderingContext2D)
  enableCanvasCommandRecording()
  enableContext2dCommandRecording(globalObject.OffscreenCanvasRenderingContext2D)
  enableReadingFromContext2dCommandRecorder(globalObject.OffscreenCanvasRenderingContext2D)
  enableOffscreenCanvasCommandRecording()
}