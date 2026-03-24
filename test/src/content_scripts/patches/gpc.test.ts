import { describe, it, expect, beforeEach } from '@jest/globals'
import gpc from '@src/content_scripts/patches/gpc'
import { defineMockProperties } from '@test/mocks/define'

describe('gpc patch', () => {
  beforeEach(() => {
    defineMockProperties(self.Navigator.prototype, { globalPrivacyControl: undefined })
  })

  describe('without patch', () => {
    it('should not expose navigator.globalPrivacyControl', () => {
      expect((navigator as { globalPrivacyControl?: unknown }).globalPrivacyControl).toBeUndefined()
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      gpc(self)
    })

    it('should expose navigator.globalPrivacyControl = true', () => {
      expect((navigator as { globalPrivacyControl?: unknown }).globalPrivacyControl).toBe(true)
    })
  })
})
