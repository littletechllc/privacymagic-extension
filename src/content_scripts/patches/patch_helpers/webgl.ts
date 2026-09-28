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

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext
type WebGLContextConstructor = {
  prototype: WebGLContext
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
