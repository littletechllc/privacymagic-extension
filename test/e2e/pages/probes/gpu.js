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

/** @returns {Promise<boolean>} */
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
  const original = context.getImageData(0, 0, 16, 16).data
  const url = canvas.toDataURL()
  return new Promise((/** @type {(value: boolean) => void} */ resolve, /** @type {(reason: Error) => void} */ reject) => {
    const image = new Image()
    image.onload = () => {
      const copy = document.createElement('canvas')
      copy.width = 16
      copy.height = 16
      const copyContext = copy.getContext('2d')
      if (copyContext == null) {
        reject(new Error('2d canvas is unavailable'))
        return
      }
      copyContext.drawImage(image, 0, 0)
      const readBack = copyContext.getImageData(0, 0, 16, 16).data
      for (let i = 0; i < original.length; i += 1) {
        if (original[i] !== readBack[i]) {
          resolve(true)
          return
        }
      }
      resolve(false)
    }
    image.onerror = () => {
      reject(new Error('canvas data URL failed to load'))
    }
    image.src = url
  })
}

async function runProbe () {
  return {
    webgl1: readWebGL('webgl'),
    webgl2: readWebGL('webgl2'),
    canvasNoised: typeof document === 'undefined' ? null : await canvasWasNoised()
  }
}
