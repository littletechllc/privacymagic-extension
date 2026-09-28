import { GlobalScope } from '@src/content_scripts/helpers/globalObject'

// One seed for this content-script context. Frames patched from here share it.
// Another website load is another context and draws its own seed.
let seed: number | undefined

// A simple 32-bit hash function (lowbias32)
const noiseBit = (value: number, index: number): number => {
  let x = Math.imul(value ^ index, 0x9E3779B1)
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  return ((x ^ (x >>> 16)) >>> 0) & 1
}

const seedFor = (globalObject: GlobalScope): number => {
  if (seed !== undefined) {
    return seed
  }
  const bytes = new Uint32Array(1)
  globalObject.crypto.getRandomValues(bytes)
  seed = bytes[0] || 1
  return seed
}

export const noiseImageDataBytes = (pixels: Uint8ClampedArray, globalObject: GlobalScope): void => {
  if (pixels.length <= 0) {
    return
  }
  const value = seedFor(globalObject)
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] ^= noiseBit(value, i)
  }
}
