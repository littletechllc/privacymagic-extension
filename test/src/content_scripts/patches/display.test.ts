import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import display from '@src/content_scripts/patches/display'

type MQList = MediaQueryList & { media: string }

describe('display patch', () => {
  let originalMatchMedia: typeof self.matchMedia | undefined
  let calls: string[]

  const installMatchMediaSpy = () => {
    calls = []
    const spy = (query: string): MQList => {
      calls.push(query)
      return {
        matches: query.trim().toLowerCase() === 'all',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      } as MQList
    }
    Object.defineProperty(self, 'matchMedia', { value: spy, configurable: true, writable: true })
  }

  beforeEach(() => {
    originalMatchMedia = self.matchMedia
    installMatchMediaSpy()
  })

  afterEach(() => {
    if (originalMatchMedia !== undefined) {
      Object.defineProperty(self, 'matchMedia', { value: originalMatchMedia, configurable: true, writable: true })
    }
  })

  describe('without patch', () => {
    it('should not rewrite prefers-reduced-motion queries', () => {
      const list = self.matchMedia('(prefers-reduced-motion: reduce)') as MQList
      expect(list.media).toBe('(prefers-reduced-motion: reduce)')
      expect(calls).toEqual(['(prefers-reduced-motion: reduce)'])
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      display(self)
      calls = []
    })

    it('should spoof prefers-reduced-motion: no-preference as a match', () => {
      const list = self.matchMedia('(prefers-reduced-motion: no-preference)') as MQList
      expect(calls).toEqual(['all'])
      expect(list.matches).toBe(true)
    })

    it('should spoof prefers-reduced-motion: reduce as not matching', () => {
      const list = self.matchMedia('(prefers-reduced-motion: reduce)') as MQList
      expect(calls).toEqual(['not all'])
      expect(list.matches).toBe(false)
    })

    it('should spoof prefers-reduced-motion (default query) as not matching', () => {
      const list = self.matchMedia('(prefers-reduced-motion)') as MQList
      expect(calls).toEqual(['not all'])
      expect(list.matches).toBe(false)
    })

    it.each([
      ['(prefers-contrast: no-preference)', 'all', true],
      ['(prefers-contrast: more)', 'not all', false],
      ['(prefers-contrast: less)', 'not all', false],
      ['(prefers-contrast: custom)', 'not all', false],
      ['(prefers-contrast)', 'not all', false],
      ['( prefers-contrast : MORE )', 'not all', false],
      ['(prefers-reduced-transparency: no-preference)', 'all', true],
      ['(prefers-reduced-transparency: reduce)', 'not all', false],
      ['(prefers-reduced-transparency)', 'not all', false]
    ])('should spoof %s as %s', (query, rewritten, matches) => {
      const list = self.matchMedia(query) as MQList
      expect(calls).toEqual([rewritten])
      expect(list.matches).toBe(matches)
    })

    it('should spoof every display feature in one query', () => {
      self.matchMedia(
        '(prefers-reduced-motion: no-preference) and (prefers-contrast: more) and (prefers-reduced-transparency: reduce)'
      )
      expect(calls).toEqual(['all and not all and not all'])
    })

    it('should leave unrelated media queries unchanged', () => {
      self.matchMedia('(prefers-color-scheme: dark) and (min-width: 600px)')
      expect(calls).toEqual(['(prefers-color-scheme: dark) and (min-width: 600px)'])
    })
  })
})

