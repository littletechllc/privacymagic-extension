import {describe, it, expect, beforeEach } from '@jest/globals'
import { defineMockProperties } from '@test/mocks/define'
import screenPatch from '@src/content_scripts/patches/screen'

// Patch uses spoofScreenSize(innerWidth, innerHeight); 800x600 => [1920, 1080]
const mockInnerWidth = 800
const mockInnerHeight = 600
const expectedSpoofedWidth = 1920
const expectedSpoofedHeight = 1080

// Leaky values that would be exposed when unpatched
const leakyScreenWidth = 5120
const leakyScreenHeight = 2880
const leakyAvailLeft = 100
const leakyAvailTop = 200
const leakyColorDepth = 32
const leakyDevicePixelRatio = 1.5
const leakyScreenLeft = 50
const leakyScreenTop = 60
const leakyOuterWidth = 1280
const leakyOuterHeight = 1024


describe('screen patch', () => {
  beforeEach(() => {
    defineMockProperties(self, {
      devicePixelRatio: leakyDevicePixelRatio,
      screenLeft: leakyScreenLeft,
      screenTop: leakyScreenTop,
      screenX: leakyScreenLeft,
      screenY: leakyScreenTop,
      outerWidth: leakyOuterWidth,
      outerHeight: leakyOuterHeight,
      innerWidth: mockInnerWidth,
      innerHeight: mockInnerHeight
    })
    defineMockProperties(self.Screen.prototype, {
      width: leakyScreenWidth,
      height: leakyScreenHeight,
      availWidth: leakyScreenWidth,
      availHeight: leakyScreenHeight,
      availLeft: leakyAvailLeft,
      availTop: leakyAvailTop,
      colorDepth: leakyColorDepth,
      pixelDepth: leakyColorDepth })
  })

  describe('without patch', () => {
    it('should leak innerWidth and innerHeight', () => {
      expect(self.innerWidth).toBe(mockInnerWidth)
      expect(self.innerHeight).toBe(mockInnerHeight)
    })

    it('should leak Screen dimensions and position', () => {
      if (self.Screen === undefined) return
      expect(self.screen.width).toBe(leakyScreenWidth)
      expect(self.screen.height).toBe(leakyScreenHeight)
      expect(self.screen.availWidth).toBe(leakyScreenWidth)
      expect(self.screen.availHeight).toBe(leakyScreenHeight)
      expect((self.screen as { availLeft?: number }).availLeft).toBe(leakyAvailLeft)
      expect((self.screen as { availTop?: number }).availTop).toBe(leakyAvailTop)
      expect(self.screen.colorDepth).toBe(leakyColorDepth)
      expect((self.screen as { pixelDepth?: number }).pixelDepth).toBe(leakyColorDepth)
    })

    it('should leak devicePixelRatio and window position', () => {
      expect(self.devicePixelRatio).toBe(leakyDevicePixelRatio)
      expect(self.screenLeft).toBe(leakyScreenLeft)
      expect(self.screenTop).toBe(leakyScreenTop)
      expect(self.screenX).toBe(leakyScreenLeft)
      expect(self.screenY).toBe(leakyScreenTop)
      expect(self.outerWidth).toBe(leakyOuterWidth)
      expect(self.outerHeight).toBe(leakyOuterHeight)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {

      if (typeof self.matchMedia !== 'function') {
        const stub = (_q: string): MediaQueryList =>
          ({ matches: false, media: '', addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true, onchange: null })
        defineMockProperties(self, { matchMedia: stub })
      }
      screenPatch(self)
    })

    it('should spoof Screen dimensions from allowed list', () => {
      if (self.Screen === undefined) return
      const scr = self.screen
      expect(scr.width).toBe(expectedSpoofedWidth)
      expect(scr.height).toBe(expectedSpoofedHeight)
      expect(scr.availWidth).toBe(expectedSpoofedWidth)
      expect(scr.availHeight).toBe(expectedSpoofedHeight)
    })

    it('should set Screen availLeft and availTop to 0', () => {
      if (self.Screen === undefined) return
      const scr = self.screen as { availLeft?: number; availTop?: number }
      expect(scr.availLeft).toBe(0)
      expect(scr.availTop).toBe(0)
    })

    it('should set Screen colorDepth and pixelDepth to 24', () => {
      if (self.Screen === undefined) return
      expect(self.screen.colorDepth).toBe(24)
      expect((self.screen as { pixelDepth?: number }).pixelDepth).toBe(24)
    })

    it('should set devicePixelRatio to 2', () => {
      expect(self.devicePixelRatio).toBe(2)
    })

    it('should set screenLeft, screenTop, screenX, screenY to 0', () => {
      expect(self.screenLeft).toBe(0)
      expect(self.screenTop).toBe(0)
      expect(self.screenX).toBe(0)
      expect(self.screenY).toBe(0)
    })

    it('should set outerWidth/outerHeight to innerWidth/innerHeight', () => {
      expect(self.outerWidth).toBe(mockInnerWidth)
      expect(self.outerHeight).toBe(mockInnerHeight)
    })

    it('should expose matchMedia that accepts color-gamut queries', () => {
      const list = self.matchMedia('(color-gamut: srgb)')
      expect(list).toBeDefined()
      expect(typeof list.matches).toBe('boolean')
    })
  })
})
