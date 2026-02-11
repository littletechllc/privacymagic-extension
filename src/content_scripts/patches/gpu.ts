import { enableCanvasFingerprintSpoofing } from '@src/content_scripts/patches/gpu_helpers/canvas'
import { hideWebGLVendorAndRenderer } from '@src/content_scripts/patches/gpu_helpers/webgl'

const gpu = (): void | (() => void) => {
  if (self.HTMLCanvasElement === undefined) {
    return () => {}
  }
  enableCanvasFingerprintSpoofing()
  hideWebGLVendorAndRenderer()
}

export default gpu
