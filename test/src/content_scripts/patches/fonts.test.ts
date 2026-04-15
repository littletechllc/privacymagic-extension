import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'

const isAllowedFontMock = jest.fn()

jest.unstable_mockModule('@src/content_scripts/patches/patch_helpers/font-filter', () => ({
  isAllowedFont: (fontName: string) => isAllowedFontMock(fontName)
}))

let fonts: (globalObject: GlobalScope) => void
beforeAll(async () => {
  const mod = await import('@src/content_scripts/patches/fonts')
  fonts = mod.default
})

function makeMockFontFaceSet (): FontFaceSet & { added: FontFace[] } {
  const added: FontFace[] = []
  const proto = {
    delete (font: FontFace) {
      const i = added.indexOf(font)
      if (i !== -1) added.splice(i, 1)
    },
    clear () { added.length = 0 },
    forEach (cb: (font: FontFace) => void) { added.forEach(cb) },
    has (_font: FontFace) { return false }
  }
  const set = Object.create(proto) as FontFaceSet & { added: FontFace[] }
  set.add = (font: FontFace) => added.push(font)
  Object.defineProperty(set, 'added', { value: added, enumerable: true })
  Object.defineProperty(set, 'size', { get: () => added.length, enumerable: true })
  return set
}

function makeMockFontFace (family: string, _source: string, _descriptors?: FontFaceDescriptors): FontFace {
  return { family, status: 'loaded', loaded: Promise.resolve({ family } as FontFace), display: 'auto', style: 'normal', weight: '400', stretch: 'normal', unicodeRange: 'U+0-10FFFF', variant: 'normal', featureSettings: 'normal', variationSettings: 'normal' } as unknown as FontFace
}

describe('fonts patch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    isAllowedFontMock.mockReturnValue(false)
  })

  it('should be a no-op when document is undefined', () => {
    const fakeGlobal = { document: undefined } as unknown as GlobalScope

    fonts(fakeGlobal)

    expect(isAllowedFontMock).not.toHaveBeenCalled()
  })

  it('should be a no-op when FontFace is null', () => {
    const fakeGlobal = { document: { fonts: {} }, FontFace: null } as unknown as GlobalScope

    fonts(fakeGlobal)

    expect(isAllowedFontMock).not.toHaveBeenCalled()
  })

  describe('when isAllowedFont returns true for all', () => {
    it('should not add empty font faces', () => {
      isAllowedFontMock.mockReturnValue(true)
      const fontFaceSet = makeMockFontFaceSet()
      const fakeGlobal = {
        document: { fonts: fontFaceSet },
        FontFace: jest.fn((family: string, source: string, descriptors?: FontFaceDescriptors) =>
          makeMockFontFace(family, source, descriptors))
      } as unknown as GlobalScope

      fonts(fakeGlobal)

      expect(fontFaceSet.added.length).toBe(0)
    })
  })

  describe('with patch enabled', () => {
    const DISALLOWED_FONTS_COUNT = 58

    it('should add empty font faces for disallowed fonts when isAllowedFont returns false', () => {
      const fontFaceSet = makeMockFontFaceSet()
      const OriginalFontFace = jest.fn((family: string, source: string, descriptors?: FontFaceDescriptors) =>
        makeMockFontFace(family, source, descriptors))
      const fakeGlobal = {
        document: { fonts: fontFaceSet },
        FontFace: OriginalFontFace
      } as unknown as GlobalScope

      fonts(fakeGlobal)

      expect(fontFaceSet.added.length).toBeGreaterThanOrEqual(50)
      expect(fontFaceSet.added.length).toBeLessThanOrEqual(DISALLOWED_FONTS_COUNT)
    })

    it('should replace global FontFace with a Proxy that sanitizes source', () => {
      const fontFaceSet = makeMockFontFaceSet()
      const OriginalFontFace = jest.fn((family: string, source: string, _descriptors?: FontFaceDescriptors) =>
        makeMockFontFace(family, source))
      const fakeGlobal = {
        document: { fonts: fontFaceSet },
        FontFace: OriginalFontFace
      } as unknown as GlobalScope

      fonts(fakeGlobal)

      const PatchedFontFace = (fakeGlobal as unknown as { FontFace: typeof FontFace }).FontFace
      expect(PatchedFontFace).toBeDefined()
      new PatchedFontFace('Test', 'url(data:,)', {})
      expect(OriginalFontFace).toHaveBeenCalledWith('Test', 'url(data:,)', {})
    })

    it('should re-add empty font face when a disallowed font is deleted from document.fonts', () => {
      const fontFaceSet = makeMockFontFaceSet()
      const OriginalFontFace = jest.fn((family: string, source: string) =>
        makeMockFontFace(family, source))
      const fakeGlobal = {
        document: { fonts: fontFaceSet },
        FontFace: OriginalFontFace
      } as unknown as GlobalScope

      fonts(fakeGlobal)

      const sizeBefore = fontFaceSet.added.length
      const firstFont = fontFaceSet.added[0]
      fontFaceSet.delete(firstFont)

      expect(fontFaceSet.added.length).toBe(sizeBefore)
    })

    it('should re-add all empty font faces when document.fonts.clear() is called', () => {
      const fontFaceSet = makeMockFontFaceSet()
      const OriginalFontFace = jest.fn((family: string, source: string) =>
        makeMockFontFace(family, source))
      const fakeGlobal = {
        document: { fonts: fontFaceSet },
        FontFace: OriginalFontFace
      } as unknown as GlobalScope

      fonts(fakeGlobal)

      const sizeAfterPatch = fontFaceSet.added.length
      fontFaceSet.clear()

      expect(fontFaceSet.added.length).toBe(sizeAfterPatch)
    })
  })
})
