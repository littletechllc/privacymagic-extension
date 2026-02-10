import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import useragent from '@src/content_scripts/patches/useragent'

const leakyPlatform = 'CustomPlatform'

describe('useragent patch', () => {
  let originalPlatformDescriptor: PropertyDescriptor | undefined
  let originalUserAgentData: unknown
  const nav = navigator as unknown as Record<string, unknown>

  beforeEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    originalPlatformDescriptor = Object.getOwnPropertyDescriptor(proto, 'platform')
    Object.defineProperty(proto, 'platform', {
      value: leakyPlatform,
      configurable: true,
      enumerable: true
    })
    originalUserAgentData = (navigator as { userAgentData?: unknown }).userAgentData
    const NavigatorUADataClass = (globalThis as unknown as Record<string, new () => { platform: string; mobile: boolean }>).NavigatorUAData
    if (NavigatorUADataClass == null) throw new Error('NavigatorUAData not defined (test/setup.ts)')
    const ua = new NavigatorUADataClass()
    Object.defineProperty(ua, 'platform', { get: () => 'Windows', configurable: true, enumerable: true })
    Object.defineProperty(ua, 'mobile', { get: () => true, configurable: true, enumerable: true })
    Object.defineProperty(navigator, 'userAgentData', { value: ua, configurable: true, enumerable: true })
  })

  afterEach(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    if (originalPlatformDescriptor !== undefined) {
      Object.defineProperty(proto, 'platform', originalPlatformDescriptor)
    } else {
      delete (proto as unknown as Record<string, unknown>).platform
    }
    if (originalUserAgentData !== undefined) {
      Object.defineProperty(navigator, 'userAgentData', { value: originalUserAgentData, configurable: true, enumerable: true })
    } else {
      delete nav.userAgentData
    }
  })

  describe('without patch', () => {
    it('should leak navigator.platform', () => {
      expect(navigator.platform).toBe(leakyPlatform)
    })

    it('should leak userAgentData.platform and mobile', () => {
      expect(navigator.userAgentData?.platform).toBe('Windows')
      expect(navigator.userAgentData?.mobile).toBe(true)
    })

    it('should return only requested keys from getHighEntropyValues (no extras)', async () => {
      const requested = ['architecture', 'model'] as HighEntropyHint[]
      const result = await navigator.userAgentData!.getHighEntropyValues(requested)
      expect(Object.keys(result).sort()).toEqual([...requested].sort())
      expect(result.architecture).toBe('arm')
      expect(result.model).toBe('Pixel')
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      useragent()
      // Remove instance own properties so prototype (patched) values are used
      const ua = navigator.userAgentData as unknown as Record<string, unknown>
      if (ua != null) {
        delete ua.platform
        delete ua.mobile
      }
    })

    it('should spoof navigator.platform to Win32 when userAgentData.platform was Windows', () => {
      expect(navigator.platform).toBe('Win32')
    })

    it('should spoof userAgentData.platform and mobile', () => {
      expect(navigator.userAgentData?.platform).toBe('Win32')
      expect(navigator.userAgentData?.mobile).toBe(false)
    })

    it('should spoof getHighEntropyValues and not add or remove requested entries', async () => {
      const requestedHints = ['architecture', 'bitness', 'formFactors', 'model', 'wow64', 'fullVersionList', 'mobile'] as HighEntropyHint[]
      const ua = navigator.userAgentData
      if (ua == null || typeof ua.getHighEntropyValues !== 'function') return
      const result = await ua.getHighEntropyValues(requestedHints)
      const resultKeys = Object.keys(result).sort()
      for (const key of requestedHints) {
        expect(result).toHaveProperty(key)
      }
      const allowedExtras = ['platform', 'brands']
      for (const key of resultKeys) {
        expect(requestedHints.includes(key as HighEntropyHint) || allowedExtras.includes(key)).toBe(true)
      }
      expect(result.architecture).toBe('x86')
      expect(result.bitness).toBe('64')
      expect(result.mobile).toBe(false)
      expect(result.formFactors).toEqual(['Desktop'])
      expect(result.model).toBe('')
      expect(result.wow64).toBe(false)
      if (result.fullVersionList != null) {
        expect(result.fullVersionList.every(({ version }) => /^\d+\.0\.0\.0$/.test(version))).toBe(true)
      }
    })
  })
})
