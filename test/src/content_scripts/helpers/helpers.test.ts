/**
 * @jest-environment-options {"url": "https://example.com/"}
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { getDisabledSettings } from '@src/content_scripts/helpers/helpers'
import { SETTING_COOKIE_PREFIX, type ContentSettingId } from '@src/common/setting-ids'

// jsdom's cookie jar cannot hold two cookies with the same name, which is exactly
// the situation we need to simulate (Chrome keeps a Partitioned cookie and an
// unpartitioned cookie with the same name as two separate cookies), so we stub
// the document.cookie accessor instead.
let cookieString = ''
let cookieWrites: string[] = []

const cookie = (settingId: string, value: string): string => `${SETTING_COOKIE_PREFIX}${settingId}=${value}`
const setCookies = (...cookies: string[]): void => { cookieString = cookies.join('; ') }

beforeEach(() => {
  cookieString = ''
  cookieWrites = []
  // getDisabledSettings caches its result in this global.
  self.__disabledSettings = undefined as unknown as ContentSettingId[]
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieString,
    set: (value: string) => { cookieWrites.push(value) }
  })
})

afterEach(() => {
  delete (document as unknown as Record<string, unknown>).cookie
})

describe('getDisabledSettings', () => {
  it('returns nothing when there are no settings cookies', () => {
    setCookies('session=abc')
    expect(getDisabledSettings()).toEqual([])
  })

  it('honors a single legitimate "0" cookie', () => {
    setCookies(cookie('gpu', '1'), cookie('audio', '0'), cookie('masterSwitch', '1'))
    expect(getDisabledSettings()).toEqual(['audio'])
  })

  it('ignores "1" cookies', () => {
    setCookies(cookie('gpu', '1'), cookie('masterSwitch', '1'))
    expect(getDisabledSettings()).toEqual([])
  })

  it('ignores cookies for unknown setting ids', () => {
    setCookies(cookie('notASetting', '0'), cookie('__proto__', '0'))
    expect(getDisabledSettings()).toEqual([])
  })

  describe('forged duplicates (any non-"0" value vetoes)', () => {
    it('does not disable masterSwitch when a forged "0" sits next to the extension\'s "1"', () => {
      setCookies(cookie('masterSwitch', '1'), cookie('masterSwitch', '0'))
      expect(getDisabledSettings()).not.toContain('masterSwitch')
    })

    it('does not depend on cookie order', () => {
      setCookies(cookie('masterSwitch', '0'), cookie('masterSwitch', '1'))
      expect(getDisabledSettings()).not.toContain('masterSwitch')
    })

    it('still honors a legitimate "0" when a harmless duplicate "0" is present', () => {
      setCookies(cookie('gpu', '0'), cookie('gpu', '0'))
      expect(getDisabledSettings()).toEqual(['gpu'])
    })

    it('keeps protection on when a forged "1" sits next to a legitimate "0"', () => {
      setCookies(cookie('gpu', '0'), cookie('gpu', '1'))
      expect(getDisabledSettings()).toEqual([])
    })

    it('treats any value other than "0" as a veto', () => {
      setCookies(cookie('gpu', '0'), cookie('gpu', 'x'))
      expect(getDisabledSettings()).toEqual([])
    })

    it('still honors other, unforged settings in the same jar', () => {
      setCookies(cookie('masterSwitch', '1'), cookie('masterSwitch', '0'), cookie('audio', '0'))
      expect(getDisabledSettings()).toEqual(['audio'])
    })
  })

  it('expires both the partitioned and the unpartitioned variant of each cookie', () => {
    setCookies(cookie('audio', '0'))
    getDisabledSettings()
    const key = `${SETTING_COOKIE_PREFIX}audio`
    expect(cookieWrites.some(w => w.startsWith(`${key}=;`) && w.includes('Partitioned'))).toBe(true)
    expect(cookieWrites.some(w => w.startsWith(`${key}=;`) && !w.includes('Partitioned'))).toBe(true)
  })
})
