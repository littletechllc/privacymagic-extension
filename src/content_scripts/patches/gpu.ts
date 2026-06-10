import { enableCanvasFingerprintSpoofing } from '@src/content_scripts/patches/patch_helpers/canvas'
import { hideWebGLVendorAndRenderer, returnNoisedBlankImageForWebGLContext } from '@src/content_scripts/patches/patch_helpers/webgl'
import { GlobalScope } from '../helpers/globalObject'

const gpu = (globalObject: GlobalScope): void => {
  if (globalObject.HTMLCanvasElement !== undefined) {
    enableCanvasFingerprintSpoofing(globalObject)
  }
  if (globalObject.WebGLRenderingContext !== undefined) {
    hideWebGLVendorAndRenderer(globalObject)
    returnNoisedBlankImageForWebGLContext(globalObject)
  }
}

export default gpu
