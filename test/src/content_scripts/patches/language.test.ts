import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import language from '@src/content_scripts/patches/language'

const mockMultipleLanguages = ['de-DE', 'de', 'en-US', 'en']
const mockLanguage = 'de-DE'

describe('language patch', () => {
  const nav = navigator as unknown as Record<string, unknown>

  const setLanguages = (languages: readonly string[], languageTag = languages[0] ?? 'en-US'): void => {
    Object.defineProperty(navigator, 'language', {
      value: languageTag,
      configurable: true,
      enumerable: true
    })
    Object.defineProperty(navigator, 'languages', {
      value: [...languages],
      configurable: true,
      enumerable: true
    })
  }

  beforeEach(() => {
    setLanguages(mockMultipleLanguages, mockLanguage)
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
    const applyPatch = (languages: readonly string[], languageTag = languages[0] ?? 'en-US'): void => {
      setLanguages(languages, languageTag)
      language(self)
      delete nav.languages
    }

    it('should keep the first language and its bare base tag', () => {
      applyPatch(mockMultipleLanguages, mockLanguage)
      expect(navigator.languages).toEqual(['de-DE', 'de'])
    })

    it('should keep a regional tag and its base language', () => {
      applyPatch(['en-US', 'en'])
      expect(navigator.languages).toEqual(['en-US', 'en'])
    })

    it('should drop other regions of the same language', () => {
      applyPatch(['en-GB', 'en-US', 'en'])
      expect(navigator.languages).toEqual(['en-GB', 'en'])
    })

    it('should leave a single language unchanged', () => {
      applyPatch(['en-US'])
      expect(navigator.languages).toEqual(['en-US'])
    })

    it('should match the base tag case-insensitively', () => {
      applyPatch(['EN-us', 'EN', 'fr'])
      expect(navigator.languages).toEqual(['EN-us', 'EN'])
    })
  })
})
