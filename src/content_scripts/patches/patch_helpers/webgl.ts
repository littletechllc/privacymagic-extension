import { createSafeMethod, redefineMethods } from '@src/content_scripts/helpers/monkey-patch'
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

export const hideWebGLVendorAndRenderer = (globalObject: GlobalScope): void => {
  if (globalObject.WebGLRenderingContext === undefined) {
    return
  }
  const originalGetParameterSafe = createSafeMethod(globalObject.WebGLRenderingContext, 'getParameter')
  if (globalObject.navigator.userAgentData != null) {
    const userAgentData: NavigatorUAData = globalObject.navigator.userAgentData
    const platform = userAgentData.platform
    const getParameter = function (this: WebGLRenderingContext, constant: number) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const originalValue = originalGetParameterSafe(this, constant)
      switch (constant) {
        case 37445: // UNMASKED_VENDOR_WEBGL
          return webglVendorAndRendererByPlatform[platform]?.vendor ?? 'Unknown'
        case 37446: // UNMASKED_RENDERER_WEBGL
          return webglVendorAndRendererByPlatform[platform]?.renderer ?? 'Unknown'
        default:
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return originalValue
      }
    }
    redefineMethods(globalObject.WebGLRenderingContext.prototype, { getParameter })
    redefineMethods(globalObject.WebGL2RenderingContext.prototype, { getParameter })
  }
}

export const returnNoisedBlankImageForWebGLContext = (globalObject: GlobalScope): void => {
  if (globalObject.WebGLRenderingContext === undefined || globalObject.WebGL2RenderingContext === undefined) {
    return
  }

  const numberOfComponentsPerPixelForFormat: Record<number, number> = {
    [globalObject.WebGLRenderingContext.ALPHA]: 1,
    [globalObject.WebGLRenderingContext.RGB]: 3,
    [globalObject.WebGLRenderingContext.RGBA]: 4,
    [globalObject.WebGL2RenderingContext.RED]: 1,
    [globalObject.WebGL2RenderingContext.RG]: 2,
    [globalObject.WebGL2RenderingContext.RED_INTEGER]: 1,
    [globalObject.WebGL2RenderingContext.RG_INTEGER]: 2,
    [globalObject.WebGL2RenderingContext.RGB_INTEGER]: 3,
    [globalObject.WebGL2RenderingContext.RGBA_INTEGER]: 4,
  }

  const bytesPerComponentForType: Record<number, number> = {
    [globalObject.WebGLRenderingContext.UNSIGNED_BYTE]: 1,
    [globalObject.WebGLRenderingContext.FLOAT]: 4,
    [globalObject.WebGL2RenderingContext.BYTE]: 1,
    [globalObject.WebGL2RenderingContext.SHORT]: 2,
    [globalObject.WebGL2RenderingContext.UNSIGNED_SHORT]: 2,
    [globalObject.WebGL2RenderingContext.INT]: 4,
    [globalObject.WebGL2RenderingContext.UNSIGNED_INT]: 4,
    [globalObject.WebGL2RenderingContext.HALF_FLOAT]: 2,
  }

  const totalBytesPerPixelForPackedType: Record<number, number> = {
    [globalObject.WebGLRenderingContext.UNSIGNED_SHORT_5_6_5]: 2,
    [globalObject.WebGLRenderingContext.UNSIGNED_SHORT_4_4_4_4]: 2,
    [globalObject.WebGLRenderingContext.UNSIGNED_SHORT_5_5_5_1]: 2,
    [globalObject.WebGL2RenderingContext.UNSIGNED_INT_2_10_10_10_REV]: 4,
    [globalObject.WebGL2RenderingContext.UNSIGNED_INT_10F_11F_11F_REV]: 4,
    [globalObject.WebGL2RenderingContext.UNSIGNED_INT_5_9_9_9_REV]: 4,
  }

  const bytesPerPixel = (format: number, type: number): number => {
    const packed = totalBytesPerPixelForPackedType[type];
    if (packed !== undefined) {
      return packed;
    }
    const components = numberOfComponentsPerPixelForFormat[format];
    const bytesPerComponent = bytesPerComponentForType[type];
    if (components === undefined || bytesPerComponent === undefined) {
      throw new Error(`Unsupported format/type combination: ${format}/${type}`);
    }
    return components * bytesPerComponent;
  }

  const arrayBufferViewBytesPerElement = (view: ArrayBufferView): number => {
    if ('BYTES_PER_ELEMENT' in view && typeof view.BYTES_PER_ELEMENT === 'number') {
      return view.BYTES_PER_ELEMENT
    }
    return 1
  }

  const fillWithLsbNoise = (pixels: ArrayBufferView, byteOffset: number, numberOfBytes: number): void => {
    const noise = new Uint8Array(numberOfBytes)
    globalObject.crypto.getRandomValues(noise)
    for (let i = 0; i < noise.length; i++) {
      noise[i] &= 0x01 // LSB
    }
    new Uint8Array(pixels.buffer, pixels.byteOffset + byteOffset, numberOfBytes).set(noise)
  }

  const patchedReadPixels = function (
    this: WebGLRenderingContext | WebGL2RenderingContext,
    _x: number, _y: number, _width: number, _height: number,
    format: number, type: number,
    pixels: ArrayBufferView | number | null,
    dstOffset?: number
  ) {
    const numberOfBytes = _width * _height * bytesPerPixel(format, type)
    if (pixels == null) {
      return
    }
    if (typeof pixels === 'number' && 'bufferSubData' in this) {
      const gl = this as WebGL2RenderingContext
      if (gl.getParameter(globalObject.WebGL2RenderingContext.PIXEL_PACK_BUFFER_BINDING) == null) {
        return
      }
      const buffer = new Uint8Array(numberOfBytes)
      fillWithLsbNoise(buffer, 0, numberOfBytes)
      // 7-arg overload: `pixels` is a byte offset into the bound PIXEL_PACK_BUFFER.
      gl.bufferSubData(globalObject.WebGL2RenderingContext.PIXEL_PACK_BUFFER, pixels, buffer)
    } else if (typeof pixels !== 'number') {
      // 8-arg overload: `dstOffset` is in elements of the destination typed array.
      const byteOffset = (dstOffset ?? 0) * arrayBufferViewBytesPerElement(pixels)
      fillWithLsbNoise(pixels, byteOffset, numberOfBytes)
    }
  }
  redefineMethods(globalObject.WebGLRenderingContext.prototype, { readPixels: patchedReadPixels })
  if (globalObject.WebGL2RenderingContext !== undefined) {
    redefineMethods(globalObject.WebGL2RenderingContext.prototype, { readPixels: patchedReadPixels })
  }
}

