import { createSafeSetter, redefinePropertyValues, reflectApplySafe, weakMapGetSafe, weakMapHasSafe, weakMapSetSafe, objectDefinePropertiesSafe, reflectConstructSafe, createSafeMethod, createSafeGetter, objectGetOwnPropertyDescriptorsSafe } from '../helpers'

const gpu = () => {
  if (self.HTMLCanvasElement === undefined) {
    return () => {}
  }

  const canvasDescriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'canvas')
  if (canvasDescriptor?.get === undefined) {
    throw new Error('canvas getter not found')
  }
  const originalCanvasFromContextSafe = createSafeGetter(CanvasRenderingContext2D, 'canvas')
  const originalGetContextSafe = createSafeMethod(HTMLCanvasElement, 'getContext')
  const originalCanvasToDataURLSafe = createSafeMethod(HTMLCanvasElement, 'toDataURL')
  const originalCanvasToBlobSafe = createSafeMethod(HTMLCanvasElement, 'toBlob')
  const originalContextGetImageDataSafe = createSafeMethod(CanvasRenderingContext2D, 'getImageData')
  const originalContextMeasureTextSafe = createSafeMethod(CanvasRenderingContext2D, 'measureText')
  const originalContextIsPointInPathSafe = createSafeMethod(CanvasRenderingContext2D, 'isPointInPath')
  const originalContextIsPointInStrokeSafe = createSafeMethod(CanvasRenderingContext2D, 'isPointInStroke')

  const originalCanvasSetWidthSafe = createSafeSetter(HTMLCanvasElement, 'width')
  const originalCanvasSetHeightSafe = createSafeSetter(HTMLCanvasElement, 'height')

  const originalContextDescriptors = objectGetOwnPropertyDescriptorsSafe(CanvasRenderingContext2D)

  const createInvisibleCanvas = (width: number, height: number): HTMLCanvasElement => {
    const shadowCanvas: HTMLCanvasElement = document.createElement('canvas')
    shadowCanvas.width = width
    shadowCanvas.height = height
    return shadowCanvas
  }

  interface Command {
    name: string
    args: any[]
    type: 'call' | 'set'
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

    recordCommand (name: string, args: any[], type: 'call' | 'set'): void {
      // Discard commands if the last command is more than 250ms old
      const timestamp = Date.now()
      if (this.commands.length > 0 && this.commands[this.commands.length - 1].timestamp < timestamp - 250) {
        this.commands = []
        this.wipeShadowCanvas()
      }
      this.commands.push({ name, args, type, timestamp })
    }

    replayCommands (): CanvasRenderingContext2D  {
      if (this.shadowContext == null) {
        this.createShadowContext()
      }
      if (this.shadowContext == null) {
        throw new Error('Shadow context not created')
      }
      for (const command of this.commands) {
        const property = command.type === 'call' ? 'value' : 'set'
        try {
          reflectApplySafe(originalContextDescriptors[command.name][property], this.shadowContext, command.args)
        } catch (error) {
          console.error('Error replaying command:', command.name, command.args, error)
        }
      }
      this.commands = []
      return this.shadowContext
    }

    createShadowContext (): void {
      this.shadowCanvas = createInvisibleCanvas(this.width, this.height)
      this.shadowContext = this.shadowCanvas.getContext('2d', { ...this.contextAttributes, willReadFrequently: true })
      // We don't need to append the shadow canvas to the document: it still gets rendered, but it's invisible.
    }

    wipeShadowCanvas (): void {
      if (this.shadowCanvas != null) {
        this.shadowCanvas.width = this.width
      }
    }

    context2dGetImageData (...args: Parameters<typeof CanvasRenderingContext2D.prototype.getImageData>): ImageData {
      return originalContextGetImageDataSafe(this.replayCommands(), ...args)
    }

    context2dMeasureText (...args: Parameters<typeof CanvasRenderingContext2D.prototype.measureText>): TextMetrics {
      return originalContextMeasureTextSafe(this.replayCommands(), ...args)
    }

    context2dIsPointInPath (...args: Parameters<typeof CanvasRenderingContext2D.prototype.isPointInPath>): boolean {
      return originalContextIsPointInPathSafe(this.replayCommands(), ...args)
    }

    context2dIsPointInStroke (...args: Parameters<typeof CanvasRenderingContext2D.prototype.isPointInStroke>): boolean {
      return originalContextIsPointInStrokeSafe(this.replayCommands(), ...args)
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

  const enableContext2dCommandRecording = () => {
    const originalDescriptors: Record<string, PropertyDescriptor> = {}
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(CanvasRenderingContext2D.prototype))) {
      if (nonDrawingCommands.includes(name)) {
        continue
      }
      originalDescriptors[name] = descriptor
      const newDescriptor = { ...descriptor }
      if (descriptor.value !== undefined) {
        newDescriptor.value = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof descriptor.value>) {
          const commandRecorder = getCommandRecorderForContext(this)
          if (commandRecorder !== undefined) {
            commandRecorder.recordCommand(name, args, 'call')
          }
        }
      } else if (descriptor.set !== undefined) {
        newDescriptor.set = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof descriptor.set>) {
          const commandRecorder = getCommandRecorderForContext(this)
          if (commandRecorder !== undefined) {
            commandRecorder.recordCommand(name, args, 'set')
          }
        }
      }
      Object.defineProperty(CanvasRenderingContext2D.prototype, name, newDescriptor)
    }
  }

  const enableReadingFromContext2dCommandRecorder = () => {
    redefinePropertyValues(CanvasRenderingContext2D.prototype, {
      getImageData: function (this: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, settings: ImageDataSettings) {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dGetImageData(sx, sy, sw, sh, settings)
        } else {
          const data = new Uint8ClampedArray(sw * sh * 4)
          return new ImageData(data, sw, sh)
        }
      },
      measureText: function (this: CanvasRenderingContext2D, ...args: Parameters<typeof CanvasRenderingContext2D.prototype.measureText>) {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dMeasureText(...args)
        } else {
          // Return a dummy value to prevent the native method from being called.
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
      isPointInPath: function (this: CanvasRenderingContext2D, ...args: Parameters<typeof CanvasRenderingContext2D.prototype.isPointInPath>) {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dIsPointInPath(...args)
        } else {
          // Return a dummy value to prevent the native method from being called.
          return false
        }
      },
      isPointInStroke: function (this: CanvasRenderingContext2D, ...args: Parameters<typeof CanvasRenderingContext2D.prototype.isPointInStroke>) {
        const commandRecorder = getCommandRecorderForContext(this)
        if (commandRecorder !== undefined) {
          return commandRecorder.context2dIsPointInStroke(...args)
        } else {
          // Return a dummy value to prevent the native method from being called.
          return false
        }
      }
    })
  }

  const enableCanvasCommandRecording = (): void => {
    redefinePropertyValues(HTMLCanvasElement.prototype, {
      getContext: function (this: HTMLCanvasElement, contextType: string, contextAttributes: CanvasRenderingContext2DSettings) {
        const context = originalGetContextSafe(this, contextType, contextAttributes)
        if (context !== null && context !== undefined && contextType === '2d') {
          // Create recorder when context is created, storing it with the canvas
          createOrGetCommandRecorder(this, contextAttributes)
        }
        return context
      },
      toDataURL: function (this: HTMLCanvasElement, type: string, quality: number) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this)!.canvasToDataURL(type, quality)
        }
        // Return a dummy data URL to prevent the native method from being called.
        return 'data:,'
      },
      toBlob: function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void, type: string, quality: number) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this)!.canvasToBlob(callback, type, quality)
        }
        // Call callback with null to prevent the native method from being called.
        // Use setTimeout to avoid blocking the main thread.
        setTimeout(() => callback(null), 0)
      }
    })
    objectDefinePropertiesSafe(HTMLCanvasElement.prototype, {
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

  const hideWebGLVendorAndRenderer = (): void => {
    const originalGetParameterSafe = createSafeMethod(self.WebGLRenderingContext, 'getParameter')
    if (navigator.userAgentData != null) {
      const userAgentData: NavigatorUAData = navigator.userAgentData
      const platform = userAgentData.platform
      if (platform === 'MacIntel') {
        redefinePropertyValues(self.WebGLRenderingContext.prototype, {
          getParameter: function (this: WebGLRenderingContext, constant: number) {
            console.log('getParameter', constant)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const originalValue = originalGetParameterSafe(this, constant)
            switch (constant) {
              case 37445: // UNMASKED_VENDOR_WEBGL
                return 'Apple Inc.'
              case 37446: // UNMASKED_RENDERER_WEBGL
                return 'Apple GPU'
              default:
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return originalValue
            }
          }
        })
      }
    }
  }

  enableContext2dCommandRecording()
  enableReadingFromContext2dCommandRecorder()
  enableCanvasCommandRecording()
  hideWebGLVendorAndRenderer()
}

export default gpu
