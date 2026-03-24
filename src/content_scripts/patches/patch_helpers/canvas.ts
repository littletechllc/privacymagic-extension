import { createSafeSetter, redefineMethods, reflectApplySafe, objectDefinePropertiesSafe, createSafeMethod, createSafeGetter, objectGetOwnPropertyDescriptorsSafe } from '@src/content_scripts/helpers/monkey-patch'
import { weakMapGetSafe, weakMapHasSafe, weakMapSetSafe, reflectConstructSafe } from '@src/content_scripts/helpers/safe'
import { GlobalScope } from '../../helpers/globalObject'

export const enableCanvasFingerprintSpoofing = (globalObject: GlobalScope): void => {
  const doc = globalObject.document
  if (doc == null) return
  const canvasDescriptor = Object.getOwnPropertyDescriptor(globalObject.CanvasRenderingContext2D.prototype, 'canvas')
  if (canvasDescriptor?.get === undefined) {
    throw new Error('canvas getter not found')
  }
  const originalCanvasFromContextSafe = createSafeGetter(globalObject.CanvasRenderingContext2D, 'canvas')
  const originalGetContextSafe = createSafeMethod(globalObject.HTMLCanvasElement, 'getContext')
  const originalCanvasToDataURLSafe = createSafeMethod(globalObject.HTMLCanvasElement, 'toDataURL')
  const originalCanvasToBlobSafe = createSafeMethod(globalObject.HTMLCanvasElement, 'toBlob')
  const originalContextGetImageDataSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'getImageData')
  const originalContextMeasureTextSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'measureText')
  const originalContextIsPointInPathSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'isPointInPath')
  const originalContextIsPointInStrokeSafe = createSafeMethod(globalObject.CanvasRenderingContext2D, 'isPointInStroke')

  const originalCanvasSetWidthSafe = createSafeSetter(globalObject.HTMLCanvasElement, 'width')
  const originalCanvasSetHeightSafe = createSafeSetter(globalObject.HTMLCanvasElement, 'height')

  const originalContextDescriptors = objectGetOwnPropertyDescriptorsSafe(globalObject.CanvasRenderingContext2D.prototype)

  const createInvisibleCanvas = (width: number, height: number): HTMLCanvasElement => {
    const shadowCanvas = doc.createElement('canvas')
    shadowCanvas.width = width
    shadowCanvas.height = height
    return shadowCanvas
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type CommandArgs = any[]

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
    shadowCanvas: HTMLCanvasElement | undefined
    shadowContext: CanvasRenderingContext2D | null = null
    width: number = 0
    height: number = 0

    constructor (contextAttributes: CanvasRenderingContext2DSettings, width: number, height: number) {
      this.contextAttributes = contextAttributes
      this.width = width
      this.height = height
    }

    recordCommand (name: string, args: CommandArgs, type: CommandType): void {
      const timestamp = Date.now()
      if (this.commands.length > 0 && this.commands[this.commands.length - 1].timestamp < timestamp - 250) {
        this.commands = []
        this.wipeShadowCanvas()
      }
      this.commands.push({ name, args, type, timestamp })
    }

    replayCommands (): CanvasRenderingContext2D {
      if (this.shadowContext == null) {
        this.createShadowContext()
      }
      if (this.shadowContext == null) {
        throw new Error('Shadow context not created')
      }
      for (const command of this.commands) {
        const descriptor = originalContextDescriptors[command.name]
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
      this.shadowCanvas = createInvisibleCanvas(this.width, this.height)
      this.shadowContext = this.shadowCanvas.getContext('2d', { ...this.contextAttributes, willReadFrequently: true })
    }

    wipeShadowCanvas (): void {
      if (this.shadowCanvas != null) {
        this.shadowCanvas.width = this.width
      }
    }

    context2dGetImageData (...args: Parameters<typeof globalObject.CanvasRenderingContext2D.prototype.getImageData>): ImageData {
      return originalContextGetImageDataSafe(this.replayCommands(), ...args)
    }

    context2dMeasureText (...args: Parameters<typeof globalObject.CanvasRenderingContext2D.prototype.measureText>): TextMetrics {
      return originalContextMeasureTextSafe(this.replayCommands(), ...args)
    }

    context2dIsPointInPath (...args: CanvasIsPointInPathArgs): boolean {
      return originalContextIsPointInPathSafe(
        this.replayCommands(),
        // createSafeMethod is typed from a single overload; all runtime shapes are valid.
        ...(args as Parameters<CanvasRenderingContext2D['isPointInPath']>)
      )
    }

    context2dIsPointInStroke (...args: CanvasIsPointInStrokeArgs): boolean {
      return originalContextIsPointInStrokeSafe(
        this.replayCommands(),
        ...(args as Parameters<CanvasRenderingContext2D['isPointInStroke']>)
      )
    }

    canvasToDataURL (type: string, quality: number): string {
      const shadowContext = this.replayCommands()
      if (shadowContext == null) {
        return 'data:,'
      }
      const shadowCanvas = originalCanvasFromContextSafe(shadowContext)
      return originalCanvasToDataURLSafe(shadowCanvas, type, quality)
    }

    canvasToBlob (callback: (blob: Blob | null) => void, type: string, quality: number): void {
      const shadowContext = this.replayCommands()
      if (shadowContext == null) {
        callback(null)
        return
      }
      const shadowCanvas = originalCanvasFromContextSafe(shadowContext)
      return originalCanvasToBlobSafe(shadowCanvas, callback, type, quality)
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

  const canvasToCommandRecorder = new WeakMap<HTMLCanvasElement, CommandRecorder>()

  const getCommandRecorderForContext = (context: CanvasRenderingContext2D): CommandRecorder | undefined => {
    const canvas = originalCanvasFromContextSafe(context)
    return weakMapGetSafe(canvasToCommandRecorder, canvas)
  }

  const createOrGetCommandRecorder = (canvas: HTMLCanvasElement, contextAttributes: CanvasRenderingContext2DSettings): CommandRecorder => {
    const existing = weakMapGetSafe(canvasToCommandRecorder, canvas)
    if (existing !== undefined) {
      return existing
    }
    const commandRecorder = reflectConstructSafe(CommandRecorder, [contextAttributes ?? {}, canvas.width, canvas.height])
    weakMapSetSafe(canvasToCommandRecorder, canvas, commandRecorder)
    return commandRecorder
  }

  const nonDrawingCommands = ['canvas', 'getImageData', 'measureText', 'isPointInPath', 'isPointInStroke']

  const enableContext2dCommandRecording = (): void => {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(globalObject.CanvasRenderingContext2D.prototype))) {
      if (nonDrawingCommands.includes(name)) {
        continue
      }
      const newDescriptor = { ...descriptor }
      if (descriptor.value !== undefined) {
        const originalValue = descriptor.value as (...a: unknown[]) => unknown
        newDescriptor.value = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof descriptor.value>) {
          const commandRecorder = getCommandRecorderForContext(this)
          if (commandRecorder !== undefined) {
            commandRecorder.recordCommand(name, args, 'call')
          }
          return reflectApplySafe(originalValue, this, args)
        }
      } else if (descriptor.set !== undefined) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalSet = descriptor.set as (...a: unknown[]) => void
        newDescriptor.set = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof descriptor.set>) {
          const commandRecorder = getCommandRecorderForContext(this)
          if (commandRecorder !== undefined) {
            commandRecorder.recordCommand(name, args, 'set')
          }
          reflectApplySafe(originalSet, this, args)
        }
      }
      Object.defineProperty(globalObject.CanvasRenderingContext2D.prototype, name, newDescriptor)
    }
  }

  const enableReadingFromContext2dCommandRecorder = (): void => {
    redefineMethods(globalObject.CanvasRenderingContext2D.prototype, {
      getImageData: function (this: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, settings: ImageDataSettings) {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dGetImageData(sx, sy, sw, sh, settings)
        } else {
          const data = new Uint8ClampedArray(sw * sh * 4)
          return new globalObject.ImageData(data, sw, sh)
        }
      },
      measureText: function (this: CanvasRenderingContext2D, ...args: Parameters<typeof globalObject.CanvasRenderingContext2D.prototype.measureText>) {
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
        this: CanvasRenderingContext2D,
        ...args: CanvasIsPointInPathArgs
      ): boolean {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dIsPointInPath(...args)
        }
        return false
      }) as CanvasRenderingContext2D['isPointInPath'],
      isPointInStroke: (function (
        this: CanvasRenderingContext2D,
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
        const context = originalGetContextSafe(this, contextType, contextAttributes)
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

  enableContext2dCommandRecording()
  enableReadingFromContext2dCommandRecorder()
  enableCanvasCommandRecording()
}

