/* global  */

import { redefinePropertyValues, reflectApplySafe, weakMapGetSafe, weakMapHasSafe, weakMapSetSafe, definePropertiesSafe, reflectConstructSafe } from '../helpers.js';

const originalCanvasFromContext = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'canvas').get;
const originalCanvasFromContextSafe = (context) => reflectApplySafe(originalCanvasFromContext, context, []);
const originalGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext').value;
const originalGetContextSafe = (canvas, contextType, contextAttributes) => reflectApplySafe(originalGetContext, canvas, [contextType, contextAttributes]);
const originalCanvasToDataURL = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toDataURL').value;
const originalCanvasToDataURLSafe = (canvas, type, quality) => reflectApplySafe(originalCanvasToDataURL, canvas, [type, quality]);
const originalCanvasToBlob = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob').value;
const originalCanvasToBlobSafe = (canvas, callback, type, quality) => reflectApplySafe(originalCanvasToBlob, canvas, [callback, type, quality]);
const originalContextGetImageData = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'getImageData').value;
const originalContextGetImageDataSafe = (context, x, y, width, height) => reflectApplySafe(originalContextGetImageData, context, [x, y, width, height]);
const originalContextMeasureText = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'measureText').value;
const originalContextMeasureTextSafe = (context, text) => reflectApplySafe(originalContextMeasureText, context, [text]);
const originalContextIsPointInPath = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'isPointInPath').value;
const originalContextIsPointInPathSafe = (context, x, y) => reflectApplySafe(originalContextIsPointInPath, context, [x, y]);
const originalContextIsPointInStroke = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'isPointInStroke').value;
const originalContextIsPointInStrokeSafe = (context, x, y) => reflectApplySafe(originalContextIsPointInStroke, context, [x, y]);
const originalCanvasSetWidth = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width').set;
const originalCanvasSetWidthSafe = (canvas, value) => reflectApplySafe(originalCanvasSetWidth, canvas, [value]);
const originalCanvasSetHeight = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height').set;
const originalCanvasSetHeightSafe = (canvas, value) => reflectApplySafe(originalCanvasSetHeight, canvas, [value]);

const originalContextDescriptors = Object.getOwnPropertyDescriptors(CanvasRenderingContext2D.prototype);

const createInvisibleCanvas = (width, height) => {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = width;
  shadowCanvas.height = height;
  shadowCanvas.style.border = '1px solid red';
  shadowCanvas.style.display = 'none';

  /*
  shadowCanvas.style.position = 'absolute';
  shadowCanvas.style.left = '-9999px';
  shadowCanvas.style.top = '-9999px';
  shadowCanvas.style.width = '0';
  shadowCanvas.style.height = '0';
  shadowCanvas.style.opacity = '0';
  shadowCanvas.style.pointerEvents = 'none';
  shadowCanvas.style.visibility = 'hidden';
  shadowCanvas.style.userSelect = 'none';
  */
  return shadowCanvas;
}

class CommandRecorder {
  commands = [];
  contextAttributes = {};
  shadowCanvas = undefined;
  shadowContext = undefined;

  constructor(contextAttributes, width, height) {
    this.contextAttributes = contextAttributes;
    this.width = width;
    this.height = height; 
  }
  recordCommand(name, args, type) {
    // Discard commands if the last command is more than 250ms old
    const timestamp = Date.now();
    if (this.commands.length > 0 && this.commands[this.commands.length - 1].timestamp < timestamp - 250) {
      this.commands = [];
      this.wipeShadowCanvas();
    }
    this.commands.push({ name, args, type, timestamp });
  }
  replayCommands() {
    //console.log('replayCommands ->', this.commands);
    if (!this.shadowContext) {
      this.createShadowContext();
    }
    for (const command of this.commands) {
      const property = command.type === "call" ? "value" : "set";
      reflectApplySafe(originalContextDescriptors[command.name][property], this.shadowContext, command.args);
    }
    this.commands = [];
    return this.shadowContext;
  }
  createShadowContext() {
    this.shadowCanvas = createInvisibleCanvas(this.width, this.height);
    this.shadowContext = this.shadowCanvas.getContext('2d', { ...this.contextAttributes, willReadFrequently: true });
    document.documentElement.appendChild(this.shadowCanvas);
  }
  wipeShadowCanvas() {
    if (this.shadowContext) {
      this.shadowCanvas.width = this.width;
    }
  }
  context2dGetImageData(x, y, width, height) {
    return originalContextGetImageDataSafe(this.replayCommands(), x, y, width, height);
  }
  context2dMeasureText(text) {
    return originalContextMeasureTextSafe(this.replayCommands(), text);
  }
  context2dIsPointInPath(x, y) {
    return originalContextIsPointInPathSafe(this.replayCommands(), x, y);
  }
  context2dIsPointInStroke(x, y) {
    return originalContextIsPointInStrokeSafe(this.replayCommands(), x, y);
  }
  canvasToDataURL(type, quality) {
    const shadowContext = this.replayCommands();
    const shadowCanvas = originalCanvasFromContextSafe(shadowContext);
    return originalCanvasToDataURLSafe(shadowCanvas, type, quality);
  }
  canvasToBlob(callback, type, quality) {
    const shadowContext = this.replayCommands();
    const shadowCanvas = originalCanvasFromContextSafe(shadowContext);
    return originalCanvasToBlobSafe(shadowCanvas, callback, type, quality);
  }
  setWidth(value) {
    this.width = value;
    if (this.shadowCanvas) {
      this.shadowCanvas.width = value;
    }
  }
  setHeight(value) {
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
    if (descriptor.value) {
      const originalMethod = descriptor.value;
      descriptor.value = function(...args) {
        const commandRecorder = getCommandRecorderForContext(this);
        if (commandRecorder) {
          commandRecorder.recordCommand(name, args, "call");
        }
        return reflectApplySafe(originalMethod, this, args);
      };
    } else if (descriptor.set) {
      const originalSet = descriptor.set;
      descriptor.set = function(...args) {
        const commandRecorder = getCommandRecorderForContext(this);
        if (commandRecorder) {
          commandRecorder.recordCommand(name, args, "set");
        }
        return reflectApplySafe(originalSet, this, args);
      };
    }
    Object.defineProperty(CanvasRenderingContext2D.prototype, name, descriptor);
  }
  return () => definePropertiesSafe(CanvasRenderingContext2D.prototype, originalDescriptors);
};

const enableReadingFromContext2dCommandRecorder = () => {
  const restore = redefinePropertyValues(CanvasRenderingContext2D.prototype, {
    getImageData: function(x, y, width, height) {
      const commandRecorder = getCommandRecorderForContext(this);
      if (commandRecorder) {
        return commandRecorder.context2dGetImageData(x, y, width, height);
      } else {
        const data = new Uint8ClampedArray(width * height * 4);
        return new ImageData(data, width, height);
      }
    },
    measureText: function(text) {
      const commandRecorder = getCommandRecorderForContext(this);
      if (commandRecorder) {
        return commandRecorder.context2dMeasureText(text);
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
    isPointInPath: function(x, y) {
      const commandRecorder = getCommandRecorderForContext(this);
      if (commandRecorder) {
        return commandRecorder.context2dIsPointInPath(x, y);
      } else {
        // Return a dummy value to prevent the native method from being called.
        return false;
      }
    },
    isPointInStroke: function(x, y) {
      const commandRecorder = getCommandRecorderForContext(this);
      if (commandRecorder) {
        return commandRecorder.context2dIsPointInStroke(x, y);
      } else {
        // Return a dummy value to prevent the native method from being called.
        return false;
      }
    },
  });
  return restore;
};

const enableCanvasCommandRecording = () => {
  const restoreReaders = redefinePropertyValues(HTMLCanvasElement.prototype, {
    getContext: function(contextType, contextAttributes) {
      const context = originalGetContextSafe(this, contextType, contextAttributes);
      if (context && contextType === '2d') {
        // Create recorder when context is created, storing it with the canvas
        createOrGetCommandRecorder(this, contextAttributes);
      }
      return context;
    },
    toDataURL: function(type, quality) {
      if (weakMapHasSafe(canvasToCommandRecorder, this)) {
        return weakMapGetSafe(canvasToCommandRecorder, this).canvasToDataURL(type, quality);
      }
      // Return a dummy data URL to prevent the native method from being called.
      return "data:,";
    },
    toBlob: function(callback, type, quality) {
      if (weakMapHasSafe(canvasToCommandRecorder, this)) {
        return weakMapGetSafe(canvasToCommandRecorder, this).canvasToBlob(callback, type, quality);
      }
      // Return null to prevent the native method from being called.
      callback(null);
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
    },
  });
  return () => {
    restoreReaders();
    restoreDimensions();
  };
};

const canvas = () => {
  const restoreContext2dPart1 = enableContext2dCommandRecording();
  const restoreContext2dPart2 = enableReadingFromContext2dCommandRecorder();
  const restoreCanvas = enableCanvasCommandRecording();
  return () => {
    restoreContext2dPart1();
    restoreContext2dPart2();
    restoreCanvas();
  };
};

export default canvas;