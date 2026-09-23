import { createSafeMethod, redefineMethods } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../../helpers/globalObject'

// Based on low-entropy results for Cover Your Tracks
// navigator.userAgentData.platform is 'MacIntel' on Intel/Apple Silicon Macs
export const webglVendorAndRendererByPlatform: Record<string, { vendor: string, renderer: string }> = {
  MacIntel: {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU'
  },
  macOS: {
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU'
  },
  Windows: {
    vendor: 'Mozilla',
    renderer: 'Mozilla'
  },
  Linux: {
    vendor: 'Mozilla',
    renderer: 'Mozilla'
  }
}

const UNMASKED_VENDOR_WEBGL = 37445
const UNMASKED_RENDERER_WEBGL = 37446
const CRYPTO_GET_RANDOM_VALUES_MAX_BYTES = 65536

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext
type WebGLContextConstructor = {
  prototype: WebGLContext
}

const noiseImageDataBytes = (pixels: Uint8ClampedArray, globalObject: GlobalScope): void => {
  const numberOfBytes = pixels.length
  if (numberOfBytes <= 0) {
    return
  }
  const noise = new Uint8Array(Math.min(numberOfBytes, CRYPTO_GET_RANDOM_VALUES_MAX_BYTES))
  for (let offset = 0; offset < numberOfBytes;) {
    const chunkSize = Math.min(noise.length, numberOfBytes - offset)
    const chunk = chunkSize === noise.length ? noise : noise.subarray(0, chunkSize)
    globalObject.crypto.getRandomValues(chunk)
    for (let i = 0; i < chunkSize; i++) {
      pixels[offset + i] ^= chunk[i] & 0x01
    }
    offset += chunkSize
  }
}

export const noiseCanvas = (
  webGlCanvas: HTMLCanvasElement,
  globalObject: GlobalScope,
  makeCopy: boolean
): HTMLCanvasElement | undefined => {
  let dest: HTMLCanvasElement
  if (makeCopy) {
  const width = webGlCanvas.width
  const height = webGlCanvas.height
  if (width <= 0 || height <= 0) {
    return undefined
  }
  dest = webGlCanvas.ownerDocument.createElement('canvas')
  dest.width = width
  dest.height = height
  } else {
    dest = webGlCanvas
  }
  const context = dest.getContext('2d')
  if (context == null) {
    return undefined
  }
  context.drawImage(webGlCanvas, 0, 0)
  const imageData = context.getImageData(0, 0, dest.width, dest.height)
  noiseImageDataBytes(imageData.data, globalObject)
  context.putImageData(imageData, 0, 0)
  return dest
}

export const hideWebGLVendorAndRenderer = (globalObject: GlobalScope): void => {
  if (globalObject.navigator.userAgentData == null) {
    return
  }
  const platform = globalObject.navigator.userAgentData.platform

  const patchGetParameter = (Context: WebGLContextConstructor): void => {
    const originalGetParameterSafe = createSafeMethod(Context as typeof WebGLRenderingContext, 'getParameter')
    const getParameter = function (this: WebGLContext, constant: number) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const originalValue = originalGetParameterSafe(this, constant)
      switch (constant) {
        case UNMASKED_VENDOR_WEBGL:
          return webglVendorAndRendererByPlatform[platform]?.vendor ?? 'Unknown'
        case UNMASKED_RENDERER_WEBGL:
          return webglVendorAndRendererByPlatform[platform]?.renderer ?? 'Unknown'
        default:
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return originalValue
      }
    }
    redefineMethods(Context.prototype, { getParameter })
  }

  if (globalObject.WebGLRenderingContext !== undefined) {
    patchGetParameter(globalObject.WebGLRenderingContext)
  }
  if (globalObject.WebGL2RenderingContext !== undefined) {
    patchGetParameter(globalObject.WebGL2RenderingContext)
  }
}
