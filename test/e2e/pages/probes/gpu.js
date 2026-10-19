/**
 * @param {string} name
 * @returns {{ vendor: string, renderer: string }}
 */
function readWebGL (name) {
  const canvas = typeof document === 'undefined'
    ? new OffscreenCanvas(16, 16)
    : document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const gl = /** @type {WebGLRenderingContext | null} */ (
    /** @type {{ getContext: (id: string) => unknown }} */ (canvas).getContext(name)
  )
  if (gl == null) {
    throw new Error(`${name} is unavailable`)
  }
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  const vendorConstant = debug == null ? 37445 : debug.UNMASKED_VENDOR_WEBGL
  const rendererConstant = debug == null ? 37446 : debug.UNMASKED_RENDERER_WEBGL
  return {
    vendor: String(gl.getParameter(vendorConstant)),
    renderer: String(gl.getParameter(rendererConstant))
  }
}

function canvasWasNoised () {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const context = canvas.getContext('2d')
  if (context == null) {
    throw new Error('2d canvas is unavailable')
  }
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 16, 16)
  const pixels = context.getImageData(0, 0, 16, 16).data
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] !== 255 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0 || pixels[i + 3] !== 255) {
      return true
    }
  }
  return false
}

function runProbe () {
  return {
    webgl1: readWebGL('webgl'),
    webgl2: readWebGL('webgl2'),
    canvasNoised: typeof document === 'undefined' ? null : canvasWasNoised()
  }
}
