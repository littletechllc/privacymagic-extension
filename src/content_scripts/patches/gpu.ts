import { enableCanvasFingerprintSpoofing } from '@src/content_scripts/patches/patch_helpers/canvas'
import { hideWebGLVendorAndRenderer } from '@src/content_scripts/patches/patch_helpers/webgl'
import { GlobalScope } from '../helpers/globalObject'

const gpu = (globalObject: GlobalScope): void => {
  if (globalObject.HTMLCanvasElement !== undefined) {
    enableCanvasFingerprintSpoofing(globalObject)
  }
  if (globalObject.WebGLRenderingContext !== undefined) {
    hideWebGLVendorAndRenderer(globalObject)
  }
}

export default gpu
