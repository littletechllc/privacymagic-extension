import { enableCanvasFingerprintSpoofing } from '@src/content_scripts/patches/patch_helpers/canvas'
import { hideWebGLVendorAndRenderer, noiseWebGLReadPixels } from '@src/content_scripts/patches/patch_helpers/webgl'
import { GlobalScope } from '../helpers/globalObject'

const gpu = (globalObject: GlobalScope): void => {
  if (globalObject.HTMLCanvasElement !== undefined) {
    enableCanvasFingerprintSpoofing(globalObject)
  }
  if (globalObject.WebGLRenderingContext !== undefined || globalObject.WebGL2RenderingContext !== undefined) {
    hideWebGLVendorAndRenderer(globalObject)
    noiseWebGLReadPixels(globalObject)
  }
}

export default gpu
