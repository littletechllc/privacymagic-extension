import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import type { ContentSettingId } from '@src/common/setting-ids'

const MOCK_HIGH_ENTROPY: HighEntropyValues = {
  brands: [],
  mobile: false,
  platform: 'Win32',
  architecture: 'x86',
  bitness: '64',
  model: 'Pixel',
  uaFullVersion: '120.0'
}

describe('patch_helpers/highEntropy', () => {
  let sanitizeGetHighEntropyValues: (globalObject: GlobalScope, disabledSettings: Exclude<ContentSettingId, 'masterSwitch'>[]) => void
  let originalGetHighEntropyValues: (hints: HighEntropyHint[]) => Promise<HighEntropyValues>

  beforeAll(async () => {
    const g = globalThis as unknown as Record<string, unknown>
    if (g.NavigatorUAData === undefined) {
      g.NavigatorUAData = class NavigatorUAData {
        async getHighEntropyValues(hints: HighEntropyHint[]): Promise<HighEntropyValues> {
          const result: HighEntropyValues = { brands: [], mobile: false, platform: '' }
          for (const key of hints) {
            const v = (MOCK_HIGH_ENTROPY as Record<string, unknown>)[key]
            if (v !== undefined) (result as Record<string, unknown>)[key] = v
          }
          return Promise.resolve(result)
        }
      }
    }
    const mod = await import('@src/content_scripts/patches/patch_helpers/highEntropy')
    sanitizeGetHighEntropyValues = mod.default
  })

  beforeEach(() => {
    const proto = (globalThis as unknown as { NavigatorUAData: typeof NavigatorUAData }).NavigatorUAData?.prototype
    if (proto != null && typeof proto.getHighEntropyValues === 'function') {
      originalGetHighEntropyValues = proto.getHighEntropyValues
    }
  })

  afterEach(() => {
    if (originalGetHighEntropyValues != null) {
      const proto = (globalThis as unknown as { NavigatorUAData: typeof NavigatorUAData }).NavigatorUAData?.prototype
      if (proto != null) {
        Object.defineProperty(proto, 'getHighEntropyValues', {
          value: originalGetHighEntropyValues,
          configurable: true,
          writable: true
        })
      }
    }
  })

  it('should no-op when NavigatorUAData is undefined', () => {
    const self = globalThis as unknown as GlobalScope & Record<string, unknown>
    const saved = self.NavigatorUAData
    self.NavigatorUAData = undefined
    expect(() => sanitizeGetHighEntropyValues(self, [])).not.toThrow()
    self.NavigatorUAData = saved
  })

  describe('when NavigatorUAData is defined', () => {
    const getUA = (): NavigatorUAData => {
      const C = (globalThis as unknown as { NavigatorUAData: typeof NavigatorUAData }).NavigatorUAData
      if (C == null) throw new Error('NavigatorUAData not defined')
      return new C()
    }

    it('should strip architecture and bitness when disabledSettings is empty', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, [])
      const ua = getUA()
      const result = await ua.getHighEntropyValues(['architecture', 'bitness'])
      expect(result.architecture).toBeUndefined()
      expect(result.bitness).toBeUndefined()
      expect('architecture' in result).toBe(false)
      expect('bitness' in result).toBe(false)
    })

    it('should keep low-entropy hints (brands, mobile, platform)', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, [])
      const ua = getUA()
      const result = await ua.getHighEntropyValues(['brands', 'platform'])
      expect(result.brands).toEqual([])
      expect(result.platform).toBe('Win32')
      expect(result.mobile).toBe(false)
    })

    it('should allow architecture and bitness when cpu is in disabledSettings', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, ['cpu'])
      const ua = getUA()
      const result = await ua.getHighEntropyValues(['architecture', 'bitness'])
      expect(result.architecture).toBe('x86')
      expect(result.bitness).toBe('64')
    })

    it('should keep uaFullVersion when useragent is in disabledSettings', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, ['useragent'])
      const ua = getUA()
      const result = await ua.getHighEntropyValues(['brands', 'uaFullVersion'])
      expect(result.brands).toEqual([])
      expect(result.uaFullVersion).toBe('120.0')
    })

    it('should strip uaFullVersion when useragent protection is enabled', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, [])
      const ua = getUA()
      const result = await ua.getHighEntropyValues(['uaFullVersion'])
      expect(result.uaFullVersion).toBeUndefined()
      expect('uaFullVersion' in result).toBe(false)
    })

    it('should allow device hints when device is in disabledSettings', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, ['device'])
      const ua = getUA()
      const result = await ua.getHighEntropyValues(['formFactors', 'model', 'platformVersion'])
      expect(result.model).toBe('Pixel')
    })

    it('should strip device hints when device protection is enabled', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, [])
      const ua = getUA()
      const result = await ua.getHighEntropyValues(['model', 'platformVersion', 'wow64'])
      expect(result.model).toBeUndefined()
      expect(result.platformVersion).toBeUndefined()
      expect(result.wow64).toBeUndefined()
    })

    it('should allow all controlled hints when cpu, device, and useragent are disabled', async () => {
      sanitizeGetHighEntropyValues(globalThis as unknown as GlobalScope, ['cpu', 'device', 'useragent'])
      const ua = getUA()
      const hints: HighEntropyHint[] = ['architecture', 'bitness', 'brands', 'formFactors', 'fullVersionList', 'model', 'platformVersion', 'uaFullVersion', 'wow64']
      const result = await ua.getHighEntropyValues(hints)
      expect(result.architecture).toBe('x86')
      expect(result.bitness).toBe('64')
      expect(result.model).toBe('Pixel')
    })
  })
})
