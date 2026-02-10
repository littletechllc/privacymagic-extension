import {describe, it, expect, beforeEach, beforeAll, afterAll} from '@jest/globals'

// Mock must be in place before timezone module loads so the patch captures it as "original"
describe('timezone patch', () => {
  let originalResolvedOptions: PropertyDescriptor | undefined

  describe('mocked unusual timezones', () => {
    let timezone: () => void
    let mockTimeZone: string
    // Offset in minutes (e.g. 330 = UTC+5:30). Patch uses -this for offsetMinutes so fractional hours work.
    let mockGetTimezoneOffset: () => number
    const baseOptions = { locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn' } as Intl.ResolvedDateTimeFormatOptions

    let originalGetTimezoneOffsetDesc: PropertyDescriptor | undefined

    beforeAll(async () => {
      originalResolvedOptions = Object.getOwnPropertyDescriptor(
        Intl.DateTimeFormat.prototype as object,
        'resolvedOptions'
      )
      originalGetTimezoneOffsetDesc = Object.getOwnPropertyDescriptor(Date.prototype, 'getTimezoneOffset')
      mockGetTimezoneOffset = () => 330
      Date.prototype.getTimezoneOffset = () => mockGetTimezoneOffset()
      mockTimeZone = 'US/Eastern'
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
        value: function (this: Intl.DateTimeFormat) {
          return { ...baseOptions, timeZone: mockTimeZone }
        },
        configurable: true,
        writable: true,
        enumerable: true
      })
      const mod = await import('@src/content_scripts/patches/timezone')
      timezone = mod.default
    })

    afterAll(() => {
      if (originalResolvedOptions !== undefined) {
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', originalResolvedOptions)
      }
      if (originalGetTimezoneOffsetDesc !== undefined) {
        Object.defineProperty(Date.prototype, 'getTimezoneOffset', originalGetTimezoneOffsetDesc)
      }
    })

    describe('without patch', () => {
      it('US/Eastern is leaked', () => {
        mockTimeZone = 'US/Eastern'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('US/Eastern')
      })

      it('Asia/Colombo is leaked', () => {
        mockTimeZone = 'Asia/Colombo'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Colombo')
      })

      it('Pacific/Chatham is leaked', () => {
        mockTimeZone = 'Pacific/Chatham'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Chatham')
      })

      it('Europe/Paris is leaked', () => {
        mockTimeZone = 'Europe/Paris'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Paris')
      })

      it('Egypt is leaked', () => {
        mockTimeZone = 'Egypt'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Egypt')
      })

      it('Chile/Continental is leaked', () => {
        mockTimeZone = 'Chile/Continental'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Chile/Continental')
      })
    })

    describe('with patch enabled', () => {
      beforeEach(() => {
        timezone()
      })

      it('US/Eastern is normalized to America/New_York', () => {
        mockTimeZone = 'US/Eastern'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York')
      })

      it('Asia/Colombo is normalized to Asia/Kolkata', () => {
        mockTimeZone = 'Asia/Colombo'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Kolkata')
      })

      it('Pacific/Chatham stays Pacific/Chatham (already representative)', () => {
        mockTimeZone = 'Pacific/Chatham'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Chatham')
      })

      it('Europe/Paris is normalized to Europe/Berlin', () => {
        mockTimeZone = 'Europe/Paris'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Berlin')
      })

      it('Egypt is normalized to Africa/Cairo', () => {
        mockTimeZone = 'Egypt'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Africa/Cairo')
      })

      it('Chile/Continental is normalized to America/Santiago', () => {
        mockTimeZone = 'Chile/Continental'
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Santiago')
      })
    })
  })
})
