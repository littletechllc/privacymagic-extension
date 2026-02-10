import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
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

const screenProp = (key: string, value: number): void => {
  Object.defineProperty(self.screen, key, { value, configurable: true, enumerable: true })
}
const selfProp = (key: string, value: number): void => {
  Object.defineProperty(self, key, { value, configurable: true, enumerable: true })
}

const SCREEN_LEAKY_KEYS = ['width', 'height', 'availWidth', 'availHeight', 'availLeft', 'availTop', 'colorDepth', 'pixelDepth'] as const
const SELF_LEAKY_KEYS = ['devicePixelRatio', 'screenLeft', 'screenTop', 'screenX', 'screenY', 'outerWidth', 'outerHeight'] as const

describe('screen patch', () => {
  const selfObj = self as unknown as Record<string, unknown>
  const screenObj = self.screen as unknown as Record<string, unknown>

  beforeEach(() => {
    Object.defineProperty(self, 'innerWidth', { value: mockInnerWidth, configurable: true, enumerable: true })
    Object.defineProperty(self, 'innerHeight', { value: mockInnerHeight, configurable: true, enumerable: true })
    if (self.Screen !== undefined) {
      screenProp('width', leakyScreenWidth)
      screenProp('height', leakyScreenHeight)
      screenProp('availWidth', leakyScreenWidth)
      screenProp('availHeight', leakyScreenHeight)
      screenProp('availLeft', leakyAvailLeft)
      screenProp('availTop', leakyAvailTop)
      screenProp('colorDepth', leakyColorDepth)
      screenProp('pixelDepth', leakyColorDepth)
    }
    selfProp('devicePixelRatio', leakyDevicePixelRatio)
    selfProp('screenLeft', leakyScreenLeft)
    selfProp('screenTop', leakyScreenTop)
    selfProp('screenX', leakyScreenLeft)
    selfProp('screenY', leakyScreenTop)
    selfProp('outerWidth', leakyOuterWidth)
    selfProp('outerHeight', leakyOuterHeight)
  })

  afterEach(() => {
    delete selfObj.innerWidth
    delete selfObj.innerHeight
    SCREEN_LEAKY_KEYS.forEach(k => delete screenObj[k])
    SELF_LEAKY_KEYS.forEach(k => delete selfObj[k])
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
      if (self.Screen === undefined) return
      // Remove leaky instance props so prototype/self patch takes effect
      SCREEN_LEAKY_KEYS.forEach(k => delete screenObj[k])
      SELF_LEAKY_KEYS.forEach(k => delete selfObj[k])
      if (typeof self.matchMedia !== 'function') {
        const stub = (_q: string): MediaQueryList =>
          ({ matches: false, media: '', addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true, onchange: null })
        Object.defineProperty(self, 'matchMedia', { value: stub, configurable: true, writable: true })
      }
      screenPatch()
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
