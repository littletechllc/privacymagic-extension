import { createSafeMethod, redefinePropertyValues } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../../helpers/globalObject'

// Based on results from https://camoufox.com/webgl-research/
// navigator.userAgentData.platform is 'MacIntel' on Intel/Apple Silicon Macs
const webglVendorAndRenderer: Record<string, { vendor: string, renderer: string }> = {
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
    if (platform === 'MacIntel' || platform === 'macOS') {
      redefinePropertyValues(globalObject.WebGLRenderingContext.prototype, {
        getParameter: function (this: WebGLRenderingContext, constant: number) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const originalValue = originalGetParameterSafe(this, constant)
          switch (constant) {
            case 37445: // UNMASKED_VENDOR_WEBGL
              return webglVendorAndRenderer[platform]?.vendor ?? 'Unknown'
            case 37446: // UNMASKED_RENDERER_WEBGL
              return webglVendorAndRenderer[platform]?.renderer ?? 'Unknown'
            default:
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return originalValue
          }
        }
      })
    }
  }
}
