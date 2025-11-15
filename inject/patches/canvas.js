/* global HTMLCanvasElement, CanvasRenderingContext2D, ImageData */

import { redefinePropertyValues, reflectApplySafe, weakMapGetSafe, weakMapHasSafe, weakMapSetSafe, definePropertiesSafe, reflectConstructSafe, createSafeMethod } from '../helpers.js';

const canvas = () => {
  if (!self.HTMLCanvasElement) {
    return () => {};
  }

  const originalCanvasFromContext = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'canvas').get;
  const originalCanvasFromContextSafe = (context) => reflectApplySafe(originalCanvasFromContext, context, []);
  const originalGetContextSafe = createSafeMethod(HTMLCanvasElement, 'getContext');
  const originalCanvasToDataURLSafe = createSafeMethod(HTMLCanvasElement, 'toDataURL');
  const originalCanvasToBlobSafe = createSafeMethod(HTMLCanvasElement, 'toBlob');
  const originalContextGetImageDataSafe = createSafeMethod(CanvasRenderingContext2D, 'getImageData');
  const originalContextMeasureTextSafe = createSafeMethod(CanvasRenderingContext2D, 'measureText');
  const originalContextIsPointInPathSafe = createSafeMethod(CanvasRenderingContext2D, 'isPointInPath');
  const originalContextIsPointInStrokeSafe = createSafeMethod(CanvasRenderingContext2D, 'isPointInStroke');

  const originalCanvasSetWidth = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width').set;
  const originalCanvasSetWidthSafe = (canvas, value) => reflectApplySafe(originalCanvasSetWidth, canvas, [value]);
  const originalCanvasSetHeight = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height').set;
  const originalCanvasSetHeightSafe = (canvas, value) => reflectApplySafe(originalCanvasSetHeight, canvas, [value]);

  const originalContextDescriptors = Object.getOwnPropertyDescriptors(CanvasRenderingContext2D.prototype);

  const createInvisibleCanvas = (width, height) => {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = width;
    shadowCanvas.height = height;
    return shadowCanvas;
  };

  class CommandRecorder {
    commands = [];
    contextAttributes = {};
    shadowCanvas = undefined;
    shadowContext = undefined;

    constructor (contextAttributes, width, height) {
      this.contextAttributes = contextAttributes;
      this.width = width;
      this.height = height;
    }

    recordCommand (name, args, type) {
      // Discard commands if the last command is more than 250ms old
      const timestamp = Date.now();
      if (this.commands.length > 0 && this.commands[this.commands.length - 1].timestamp < timestamp - 250) {
        this.commands = [];
        this.wipeShadowCanvas();
      }
      this.commands.push({ name, args, type, timestamp });
    }

    replayCommands () {
      if (!this.shadowContext) {
        this.createShadowContext();
      }
      for (const command of this.commands) {
        const property = command.type === 'call' ? 'value' : 'set';
        try {
          reflectApplySafe(originalContextDescriptors[command.name][property], this.shadowContext, command.args);
        } catch (error) {
          console.error('Error replaying command:', command.name, command.args, error);
        }
      }
      this.commands = [];
      return this.shadowContext;
    }

    createShadowContext () {
      this.shadowCanvas = createInvisibleCanvas(this.width, this.height);
      this.shadowContext = this.shadowCanvas.getContext('2d', { ...this.contextAttributes, willReadFrequently: true });
      // We don't need to append the shadow canvas to the document: it still gets rendered, but it's invisible.
    }

    wipeShadowCanvas () {
      if (this.shadowContext) {
        this.shadowCanvas.width = this.width;
      }
    }

    context2dGetImageData (...args) {
      return originalContextGetImageDataSafe(this.replayCommands(), ...args);
    }

    context2dMeasureText (...args) {
      return originalContextMeasureTextSafe(this.replayCommands(), ...args);
    }

    context2dIsPointInPath (...args) {
      return originalContextIsPointInPathSafe(this.replayCommands(), ...args);
    }

    context2dIsPointInStroke (...args) {
      return originalContextIsPointInStrokeSafe(this.replayCommands(), ...args);
    }

    canvasToDataURL (type, quality) {
      const shadowContext = this.replayCommands();
      const shadowCanvas = originalCanvasFromContextSafe(shadowContext);
      return originalCanvasToDataURLSafe(shadowCanvas, type, quality);
    }

    canvasToBlob (callback, type, quality) {
      const shadowContext = this.replayCommands();
      const shadowCanvas = originalCanvasFromContextSafe(shadowContext);
      return originalCanvasToBlobSafe(shadowCanvas, callback, type, quality);
    }

    setWidth (value) {
      this.width = value;
      if (this.shadowCanvas) {
        this.shadowCanvas.width = value;
      }
    }

    setHeight (value) {
      this.height = value;
      if (this.shadowCanvas) {
        this.shadowCanvas.height = value;
      }
    }
  }

  const canvasToCommandRecorder = new WeakMap();

  const getCommandRecorderForContext = (context) => {
    const canvas = originalCanvasFromContextSafe(context);
    return weakMapGetSafe(canvasToCommandRecorder, canvas);
  };

  const createOrGetCommandRecorder = (canvas, contextAttributes) => {
    if (weakMapHasSafe(canvasToCommandRecorder, canvas)) {
      return weakMapGetSafe(canvasToCommandRecorder, canvas);
    }
    const commandRecorder = reflectConstructSafe(CommandRecorder, [contextAttributes || {}, canvas.width, canvas.height]);
    weakMapSetSafe(canvasToCommandRecorder, canvas, commandRecorder);
    return commandRecorder;
  };

  const nonDrawingCommands = ['canvas', 'getImageData', 'measureText', 'isPointInPath', 'isPointInStroke'];

  const enableContext2dCommandRecording = () => {
    const originalDescriptors = {};
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(CanvasRenderingContext2D.prototype))) {
      if (nonDrawingCommands.includes(name)) {
        continue;
      }
      originalDescriptors[name] = descriptor;
      const newDescriptor = { ...descriptor };
      if (descriptor.value) {
        const originalMethod = descriptor.value;
        newDescriptor.value = function (...args) {
          const commandRecorder = getCommandRecorderForContext(this);
          if (commandRecorder) {
            commandRecorder.recordCommand(name, args, 'call');
          }
          return reflectApplySafe(originalMethod, this, args);
        };
      } else if (descriptor.set) {
        const originalSet = descriptor.set;
        newDescriptor.set = function (...args) {
          const commandRecorder = getCommandRecorderForContext(this);
          if (commandRecorder) {
            commandRecorder.recordCommand(name, args, 'set');
          }
          return reflectApplySafe(originalSet, this, args);
        };
      }
      Object.defineProperty(CanvasRenderingContext2D.prototype, name, newDescriptor);
    }
    return () => definePropertiesSafe(CanvasRenderingContext2D.prototype, originalDescriptors);
  };

  const enableReadingFromContext2dCommandRecorder = () => {
    const restore = redefinePropertyValues(CanvasRenderingContext2D.prototype, {
      getImageData: function (sx, sy, sw, sh, settings) {
        const commandRecorder = getCommandRecorderForContext(this);
        if (commandRecorder) {
          return commandRecorder.context2dGetImageData(sx, sy, sw, sh, settings);
        } else {
          const data = new Uint8ClampedArray(sw * sh * 4);
          return new ImageData(data, sw, sh);
        }
      },
      measureText: function (...args) {
        const commandRecorder = getCommandRecorderForContext(this);
        if (commandRecorder) {
          return commandRecorder.context2dMeasureText(...args);
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
          };
        }
      },
      isPointInPath: function (...args) {
        const commandRecorder = getCommandRecorderForContext(this);
        if (commandRecorder) {
          return commandRecorder.context2dIsPointInPath(...args);
        } else {
          // Return a dummy value to prevent the native method from being called.
          return false;
        }
      },
      isPointInStroke: function (...args) {
        const commandRecorder = getCommandRecorderForContext(this);
        if (commandRecorder) {
          return commandRecorder.context2dIsPointInStroke(...args);
        } else {
          // Return a dummy value to prevent the native method from being called.
          return false;
        }
      }
    });
    return restore;
  };

  const enableCanvasCommandRecording = () => {
    const restoreReaders = redefinePropertyValues(HTMLCanvasElement.prototype, {
      getContext: function (contextType, contextAttributes) {
        const context = originalGetContextSafe(this, contextType, contextAttributes);
        if (context && contextType === '2d') {
          // Create recorder when context is created, storing it with the canvas
          createOrGetCommandRecorder(this, contextAttributes);
        }
        return context;
      },
      toDataURL: function (type, quality) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this).canvasToDataURL(type, quality);
        }
        // Return a dummy data URL to prevent the native method from being called.
        return 'data:,';
      },
      toBlob: function (callback, type, quality) {
        if (weakMapHasSafe(canvasToCommandRecorder, this)) {
          return weakMapGetSafe(canvasToCommandRecorder, this).canvasToBlob(callback, type, quality);
        }
        // Call callback with null to prevent the native method from being called.
        // Use setTimeout to avoid blocking the main thread.
        setTimeout(() => callback(null), 0);
      }
    });
    const restoreDimensions = definePropertiesSafe(HTMLCanvasElement.prototype, {
      width: {
        set: function (value) {
          originalCanvasSetWidthSafe(this, value);
          if (weakMapHasSafe(canvasToCommandRecorder, this)) {
            weakMapGetSafe(canvasToCommandRecorder, this).setWidth(value);
          }
        }
      },
      height: {
        set: function (value) {
          originalCanvasSetHeightSafe(this, value);
          if (weakMapHasSafe(canvasToCommandRecorder, this)) {
            weakMapGetSafe(canvasToCommandRecorder, this).setHeight(value);
          }
        }
      }
    });
    return () => {
      restoreReaders();
      restoreDimensions();
    };
  };

  const hideWebGLVendorAndRenderer = () => {
    const originalGetParameterSafe = createSafeMethod(WebGLRenderingContext, 'getParameter');
    const platform = navigator.userAgentData.platform;
    if (platform === 'macOS') {
      return redefinePropertyValues(WebGLRenderingContext.prototype, {
        getParameter: function (constant) {
          console.log('getParameter', constant);
          const originalValue = originalGetParameterSafe(this, constant);
          switch (constant) {
            case 37445: // UNMASKED_VENDOR_WEBGL
              return 'Apple Inc.';
            case 37446: // UNMASKED_RENDERER_WEBGL
              return 'Apple GPU';
            default:
              return originalValue;
          }
        }
      });
    }
    return () => {};
  };

  const restoreContext2dPart1 = enableContext2dCommandRecording();
  const restoreContext2dPart2 = enableReadingFromContext2dCommandRecorder();
  const restoreCanvas = enableCanvasCommandRecording();
  const restoreWebGLVendorAndRenderer = hideWebGLVendorAndRenderer();
  return () => {
    restoreContext2dPart1();
    restoreContext2dPart2();
    restoreCanvas();
    restoreWebGLVendorAndRenderer();
  };
};

export default canvas;
