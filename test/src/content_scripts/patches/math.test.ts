import { describe, it, expect, beforeAll } from '@jest/globals'
import { Buffer } from 'buffer'
import math from '@src/content_scripts/patches/math'

// Polyfill Uint8Array.fromBase64 for Node/jest (declared in window-extensions.d.ts at runtime)
if (typeof (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64 !== 'function') {
  ;(Uint8Array as unknown as { fromBase64: (s: string) => Uint8Array }).fromBase64 = (base64: string) =>
    new Uint8Array(Buffer.from(base64, 'base64'))
}

// Apply the math patch once so Math.* uses the WASM implementation
beforeAll(() => {
  math()
})

describe('math patch', () => {
  it('Math.acos(0.123)', () => {
    expect(Math.acos(0.123)).toBe(1.4474840516030247)
  })

  it('Math.acos(Math.SQRT1_2)', () => {
    expect(Math.acos(Math.SQRT1_2)).toBe(0.7853981633974483)
  })

  it('Math.acosh(Math.PI)', () => {
    expect(Math.acosh(Math.PI)).toBe(1.811526272460853)
  })

  it('Math.acosh(Math.SQRT2)', () => {
    expect(Math.acosh(Math.SQRT2)).toBe(0.881373587019543)
  })

  it('Math.asin(0.123)', () => {
    expect(Math.asin(0.123)).toBe(0.12331227519187199)
  })

  it('Math.asinh(Math.PI)', () => {
    expect(Math.asinh(Math.PI)).toBe(1.8622957433108482)
  })

  it('Math.atan(2)', () => {
    expect(Math.atan(2)).toBe(1.1071487177940904)
  })

  it('Math.atan(Math.PI)', () => {
    expect(Math.atan(Math.PI)).toBe(1.2626272556789115)
  })

  it('Math.atanh(0.5)', () => {
    expect(Math.atanh(0.5)).toBe(0.5493061443340548)
  })

  it('Math.atan2(1e-310, 2)', () => {
    expect(Math.atan2(1e-310, 2)).toBe(5e-311)
  })

  it('Math.cbrt(100)', () => {
    expect(Math.cbrt(100)).toBe(4.641588833612779)
  })

  it('Math.cbrt(Math.PI)', () => {
    expect(Math.cbrt(Math.PI)).toBe(1.4645918875615231)
  })

  it('Math.cos(21*Math.LN2)', () => {
    expect(Math.cos(21 * Math.LN2)).toBe(-0.4067775970251724)
  })

  it('Math.cos(21*Math.SQRT1_2)', () => {
    expect(Math.cos(21 * Math.SQRT1_2)).toBe(-0.6534063185820198)
  })

  it('Math.cosh(Math.PI)', () => {
    expect(Math.cosh(Math.PI)).toBe(11.591953275521519)
  })

  it('Math.cosh(492*Math.LOG2E)', () => {
    expect(Math.cosh(492 * Math.LOG2E)).toBe(9.199870313877772e307)
  })

  it('Math.expm1(1)', () => {
    expect(Math.expm1(1)).toBe(1.718281828459045)
  })

  it('Math.expm1(Math.PI)', () => {
    expect(Math.expm1(Math.PI)).toBe(22.140692632779267)
  })

  it('Math.exp(Math.PI)', () => {
    expect(Math.exp(Math.PI)).toBe(23.140692632779267)
  })

  it('Math.hypot(1, 2, 3, 4, 5, 6)', () => {
    expect(Math.hypot(1, 2, 3, 4, 5, 6)).toBe(9.539392014169456)
  })

  it('Math.hypot(Math.LOG2E, -100)', () => {
    expect(Math.hypot(Math.LOG2E, -100)).toBe(100.01040630344929)
  })

  it('Math.log(Math.PI)', () => {
    expect(Math.log(Math.PI)).toBe(1.1447298858494002)
  })

  it('Math.log1p(Math.PI)', () => {
    expect(Math.log1p(Math.PI)).toBe(1.4210804127942926)
  })

  it('Math.log10(Math.LOG10E)', () => {
    expect(Math.log10(Math.LOG10E)).toBe(-0.36221568869946325)
  })

  it('Math.log10(7*Math.LOG10E)', () => {
    expect(Math.log10(7 * Math.LOG10E)).toBe(0.48288235131479357)
  })

  it('Math.pow(Math.PI, -100)', () => {
    expect(Math.pow(Math.PI, -100)).toBe(1.9275814160560204e-50)
  })

  it('Math.pow(2e-3, -100)', () => {
    expect(Math.pow(2e-3, -100)).toBe(7.888609052210102e269)
  })

  it('Math.sin(Math.PI)', () => {
    expect(Math.sin(Math.PI)).toBe(1.2246467991473532e-16)
  })

  it('Math.sin(39*Math.E)', () => {
    expect(Math.sin(39 * Math.E)).toBe(-0.7181630308570678)
  })

  it('Math.sinh(1)', () => {
    expect(Math.sinh(1)).toBe(1.1752011936438014)
  })

  it('Math.sinh(Math.PI)', () => {
    expect(Math.sinh(Math.PI)).toBe(11.548739357257748)
  })

  it('Math.sinh(492*Math.LOG2E)', () => {
    expect(Math.sinh(492 * Math.LOG2E)).toBe(9.199870313877772e307)
  })

  it('Math.sqrt(0.123)', () => {
    expect(Math.sqrt(0.123)).toBe(0.3507135583350036)
  })

  it('Math.tan(Math.PI)', () => {
    expect(Math.tan(Math.PI)).toBe(-1.2246467991473532e-16)
  })

  it('Math.tan(10*Math.LOG2E)', () => {
    expect(Math.tan(10 * Math.LOG2E)).toBe(-3.3537128705376014)
  })

  it('Math.tanh(0.123)', () => {
    expect(Math.tanh(0.123)).toBe(0.12238344189440875)
  })

  it('Math.tanh(Math.PI)', () => {
    expect(Math.tanh(Math.PI)).toBe(0.99627207622075)
  })
})
