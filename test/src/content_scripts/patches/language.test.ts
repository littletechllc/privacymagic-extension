import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import language from '@src/content_scripts/patches/language'

const mockMultipleLanguages = ['de-DE', 'de', 'en-US', 'en']
const mockLanguage = 'de-DE'

describe('language patch', () => {
  const nav = navigator as unknown as Record<string, unknown>

  beforeEach(() => {
    Object.defineProperty(navigator, 'language', {
      value: mockLanguage,
      configurable: true,
      enumerable: true
    })
    Object.defineProperty(navigator, 'languages', {
      value: [...mockMultipleLanguages],
      configurable: true,
      enumerable: true
    })
  })

  afterEach(() => {
    delete nav.language
    delete nav.languages
  })

  describe('without patch', () => {
    it('should return multiple languages when unpatched', () => {
      expect(navigator.language).toBe(mockLanguage)
      expect(navigator.languages).toEqual(mockMultipleLanguages)
      expect(navigator.languages).toHaveLength(4)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      delete nav.languages
      language()
    })

    it('should reduce languages to single entry matching navigator.language', () => {
      expect(navigator.languages).toHaveLength(1)
      expect(navigator.languages[0]).toBe(mockLanguage)
    })
  })
})
