import { createSafeMethod, redefineMethods, reflectApplySafe } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../../helpers/globalObject'

// Based on results from https://camoufox.com/webgl-research/
// navigator.userAgentData.platform is 'MacIntel' on Intel/Apple Silicon Macs
export const webglVendorAndRendererByPlatform: Record<string, { vendor: string, renderer: string }> = {
  MacIntel: {
    vendor: 'Apple',
    renderer: 'Apple M1'
  },
  macOS: {
    vendor: 'Apple',
    renderer: 'Apple M1'
  },
  Windows: {
    vendor: 'NVIDIA',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 980 Direct3D11 vs_5_0 ps_5_0), or similar'
  },
  Linux: {
    vendor: 'Intel',
    renderer: 'Intel(R) HD Graphics'
  }
}

const UNMASKED_VENDOR_WEBGL = 37445
const UNMASKED_RENDERER_WEBGL = 37446
const CRYPTO_GET_RANDOM_VALUES_MAX_BYTES = 65536

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext
type WebGLContextConstructor = {
  prototype: WebGLContext
}
type ReadPixelsArgs = [
  x: number,
  y: number,
  width: number,
  height: number,
  format: number,
  type: number,
  pixels: ArrayBufferView | number | null,
  dstOffset?: number
]

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

export const noiseWebGLReadPixels = (globalObject: GlobalScope): void => {
  const gl1 = globalObject.WebGLRenderingContext
  const gl2 = globalObject.WebGL2RenderingContext
  if (gl1 === undefined && gl2 === undefined) {
    return
  }

  const numberOfComponentsPerPixelForFormat: Record<number, number> = {}
  const bytesPerComponentForType: Record<number, number> = {}
  const totalBytesPerPixelForPackedType: Record<number, number> = {}

  if (gl1 !== undefined) {
    numberOfComponentsPerPixelForFormat[gl1.ALPHA] = 1
    numberOfComponentsPerPixelForFormat[gl1.RGB] = 3
    numberOfComponentsPerPixelForFormat[gl1.RGBA] = 4
    numberOfComponentsPerPixelForFormat[gl1.LUMINANCE] = 1
    numberOfComponentsPerPixelForFormat[gl1.LUMINANCE_ALPHA] = 2
    bytesPerComponentForType[gl1.UNSIGNED_BYTE] = 1
    bytesPerComponentForType[gl1.FLOAT] = 4
    totalBytesPerPixelForPackedType[gl1.UNSIGNED_SHORT_5_6_5] = 2
    totalBytesPerPixelForPackedType[gl1.UNSIGNED_SHORT_4_4_4_4] = 2
    totalBytesPerPixelForPackedType[gl1.UNSIGNED_SHORT_5_5_5_1] = 2
  }
  if (gl2 !== undefined) {
    numberOfComponentsPerPixelForFormat[gl2.RED] = 1
    numberOfComponentsPerPixelForFormat[gl2.RG] = 2
    numberOfComponentsPerPixelForFormat[gl2.RED_INTEGER] = 1
    numberOfComponentsPerPixelForFormat[gl2.RG_INTEGER] = 2
    numberOfComponentsPerPixelForFormat[gl2.RGB_INTEGER] = 3
    numberOfComponentsPerPixelForFormat[gl2.RGBA_INTEGER] = 4
    bytesPerComponentForType[gl2.BYTE] = 1
    bytesPerComponentForType[gl2.SHORT] = 2
    bytesPerComponentForType[gl2.UNSIGNED_SHORT] = 2
    bytesPerComponentForType[gl2.INT] = 4
    bytesPerComponentForType[gl2.UNSIGNED_INT] = 4
    bytesPerComponentForType[gl2.HALF_FLOAT] = 2
    totalBytesPerPixelForPackedType[gl2.UNSIGNED_INT_2_10_10_10_REV] = 4
    totalBytesPerPixelForPackedType[gl2.UNSIGNED_INT_10F_11F_11F_REV] = 4
    totalBytesPerPixelForPackedType[gl2.UNSIGNED_INT_5_9_9_9_REV] = 4
  }

  const bytesPerPixel = (format: number, type: number): number | undefined => {
    const packed = totalBytesPerPixelForPackedType[type]
    if (packed !== undefined) {
      return packed
    }
    const components = numberOfComponentsPerPixelForFormat[format]
    const bytesPerComponent = bytesPerComponentForType[type]
    if (components === undefined || bytesPerComponent === undefined) {
      return undefined
    }
    return components * bytesPerComponent
  }

  const arrayBufferViewBytesPerElement = (view: ArrayBufferView): number => {
    if ('BYTES_PER_ELEMENT' in view && typeof view.BYTES_PER_ELEMENT === 'number') {
      return view.BYTES_PER_ELEMENT
    }
    return 1
  }

  const xorLsbNoise = (pixels: ArrayBufferView, byteOffset: number, numberOfBytes: number): void => {
    if (numberOfBytes <= 0) {
      return
    }
    const view = new Uint8Array(pixels.buffer, pixels.byteOffset + byteOffset, numberOfBytes)
    const noise = new Uint8Array(Math.min(numberOfBytes, CRYPTO_GET_RANDOM_VALUES_MAX_BYTES))
    for (let offset = 0; offset < numberOfBytes;) {
      const chunkSize = Math.min(noise.length, numberOfBytes - offset)
      const chunk = chunkSize === noise.length ? noise : noise.subarray(0, chunkSize)
      globalObject.crypto.getRandomValues(chunk)
      for (let i = 0; i < chunkSize; i++) {
        view[offset + i] ^= chunk[i] & 0x01
      }
      offset += chunkSize
    }
  }

  const noiseReadPixelsDestination = (
    gl: WebGLContext,
    width: number,
    height: number,
    format: number,
    type: number,
    pixels: ArrayBufferView | number | null,
    dstOffset: number | undefined
  ): void => {
    if (pixels == null) {
      return
    }
    const bpp = bytesPerPixel(format, type)
    if (bpp === undefined) {
      return
    }
    const numberOfBytes = width * height * bpp
    if (!Number.isFinite(numberOfBytes) || numberOfBytes <= 0) {
      return
    }
    if (typeof pixels === 'number') {
      if (gl2 === undefined || !('getBufferSubData' in gl)) {
        return
      }
      if (gl.getParameter(gl2.PIXEL_PACK_BUFFER_BINDING) == null) {
        return
      }
      const buffer = new Uint8Array(numberOfBytes)
      gl.getBufferSubData(gl2.PIXEL_PACK_BUFFER, pixels, buffer)
      xorLsbNoise(buffer, 0, numberOfBytes)
      gl.bufferSubData(gl2.PIXEL_PACK_BUFFER, pixels, buffer)
      return
    }
    const byteOffset = (dstOffset ?? 0) * arrayBufferViewBytesPerElement(pixels)
    const available = pixels.byteLength - byteOffset
    if (available <= 0) {
      return
    }
    xorLsbNoise(pixels, byteOffset, Math.min(numberOfBytes, available))
  }

  const patchReadPixels = (Context: WebGLContextConstructor): void => {
    const originalReadPixels = Context.prototype.readPixels
    const patchedReadPixels = function (this: WebGLContext, ...args: ReadPixelsArgs): void {
      reflectApplySafe(
        originalReadPixels as (this: WebGLContext, ...readPixelsArgs: ReadPixelsArgs) => void,
        this,
        args
      )
      try {
        const [_x, _y, width, height, format, type, pixels, dstOffset] = args
        noiseReadPixelsDestination(this, width, height, format, type, pixels, dstOffset)
      } catch {
        // Fingerprint noise must not break the page after a successful readback.
      }
    }
    redefineMethods(Context.prototype, { readPixels: patchedReadPixels })
  }

  if (gl1 !== undefined) {
    patchReadPixels(gl1)
  }
  if (gl2 !== undefined) {
    patchReadPixels(gl2)
  }
}
