import { describe, it, expect } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { noiseImageDataBytes } from '@src/content_scripts/patches/patch_helpers/noise'

const globalWithFill = (fill: number): GlobalScope => ({
  crypto: {
    getRandomValues <T extends ArrayBufferView>(array: T): T {
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(fill)
      return array
    }
  }
}) as unknown as GlobalScope

describe('patch_helpers/noise', () => {
  it('should reuse one seed for repeated reads on the same global', () => {
    const globalObject = globalWithFill(1)
    const first = new Uint8ClampedArray([10, 20, 30, 255, 4, 5, 6, 7])
    const second = new Uint8ClampedArray(first)
    noiseImageDataBytes(first, globalObject)
    noiseImageDataBytes(second, globalObject)
    expect(Array.from(second)).toEqual(Array.from(first))
  })

  it('should reuse one seed across globals', () => {
    const first = new Uint8ClampedArray([10, 20, 30, 255, 4, 5, 6, 7])
    const second = new Uint8ClampedArray(first)
    noiseImageDataBytes(first, globalWithFill(1))
    noiseImageDataBytes(second, globalWithFill(2))
    expect(Array.from(second)).toEqual(Array.from(first))
  })
})
