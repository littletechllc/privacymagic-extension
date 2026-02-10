import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import gpc from '@src/content_scripts/patches/gpc'

describe('gpc patch', () => {
  let originalGpcDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    originalGpcDescriptor = Object.getOwnPropertyDescriptor(proto, 'globalPrivacyControl')
    // Chrome-like baseline: GPC is not exposed unless enabled.
    delete (proto as unknown as Record<string, unknown>).globalPrivacyControl
  })

  afterEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    if (originalGpcDescriptor !== undefined) {
      Object.defineProperty(proto, 'globalPrivacyControl', originalGpcDescriptor)
    } else {
      delete (proto as unknown as Record<string, unknown>).globalPrivacyControl
    }
  })

  describe('without patch', () => {
    it('should not expose navigator.globalPrivacyControl', () => {
      expect((navigator as { globalPrivacyControl?: unknown }).globalPrivacyControl).toBeUndefined()
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      gpc()
    })

    it('should expose navigator.globalPrivacyControl = true', () => {
      expect((navigator as { globalPrivacyControl?: unknown }).globalPrivacyControl).toBe(true)
    })
  })
})

