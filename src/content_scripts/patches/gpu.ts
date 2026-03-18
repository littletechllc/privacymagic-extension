import { enableCanvasFingerprintSpoofing } from '@src/content_scripts/patches/patch_helpers/canvas'
import { hideWebGLVendorAndRenderer } from '@src/content_scripts/patches/patch_helpers/webgl'
import { GlobalScope } from '../helpers/globalObject'

const gpu = (globalObject: GlobalScope): void | (() => void) => {
  if (globalObject.HTMLCanvasElement === undefined) {
    return () => {}
  }
  enableCanvasFingerprintSpoofing(globalObject)
  hideWebGLVendorAndRenderer(globalObject)
}

export default gpu
