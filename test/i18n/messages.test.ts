import { describe, it, expect } from '@jest/globals'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Parity checks for Chrome extension _locales messages.json (see MDN / Chrome i18n).
 *
 * Canonical layout: a Jest test under `test/` (see jest.config.js testMatch). A folder like
 * `src/test` would not be picked up unless testMatch were changed.
 *
 * Checks:
 * - Every locale dir has parsable messages.json
 * - Same top-level keys as src/_locales/en/messages.json
 * - Each message entry has the same JSON shape as en (keys only); translated `message`,
 *   `description`, and placeholder `example` strings may differ from en.
 * - `placeholders.*.content` must match en (e.g. $1, $2).
 * - Placeholder tokens in `message` match en: $name$ (Chrome) and {name} (app-specific)
 *
 * Run: `npm run test:i18n` (or full `npm test`). Use `npm run sync:locale-messages` to add/remove
 * keys from en while preserving existing translations where possible.
 */
const LOCALES_ROOT = join(process.cwd(), 'src', '_locales')
const CANONICAL_LOCALE = 'en'

type Json = null | string | number | boolean | Json[] | { [k: string]: Json }

const sorted = <T extends string>(xs: T[]): T[] => [...xs].sort()

/** Chrome named placeholders in messages, e.g. $sync_option$ */
const DOLLAR_PLACEHOLDER = /\$([a-zA-Z_][a-zA-Z0-9_]*)\$/g
/** App / template tokens, e.g. {puzzleIcon} */
const BRACE_TOKEN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g

function tokenSets (message: string): { dollar: string[]; brace: string[] } {
  return {
    dollar: sorted([...message.matchAll(DOLLAR_PLACEHOLDER)].map((m) => m[1])),
    brace: sorted([...message.matchAll(BRACE_TOKEN)].map((m) => m[1]))
  }
}

function loadMessages (locale: string): Record<string, Json> {
  const path = join(LOCALES_ROOT, locale, 'messages.json')
  const raw = readFileSync(path, 'utf8')
  return JSON.parse(raw) as Record<string, Json>
}

function listLocaleCodes (): string[] {
  return readdirSync(LOCALES_ROOT).filter((name) => {
    const p = join(LOCALES_ROOT, name)
    return statSync(p).isDirectory()
  })
}

/**
 * Same keys / nesting as en; translated leaves need not equal en except `placeholders.*.content`.
 */
function assertStructureMatches (enVal: Json, locVal: Json, dotPath: string): void {
  if (enVal === null || typeof enVal !== 'object' || Array.isArray(enVal)) {
    if (typeof enVal === 'string') {
      if (dotPath.endsWith('.message') || dotPath.endsWith('.description')) {
        expect(typeof locVal).toBe('string')
        return
      }
      if (dotPath.endsWith('.example')) {
        expect(typeof locVal).toBe('string')
        expect((locVal as string).length).toBeGreaterThan(0)
        return
      }
      if (dotPath.endsWith('.content')) {
        expect(locVal).toBe(enVal)
        return
      }
    }
    expect(locVal).toEqual(enVal)
    return
  }
  if (locVal === null || typeof locVal !== 'object' || Array.isArray(locVal)) {
    expect(locVal).toEqual(enVal)
    return
  }
  const enKeys = sorted(Object.keys(enVal))
  const locKeys = sorted(Object.keys(locVal))
  expect(locKeys).toEqual(enKeys)
  for (const k of enKeys) {
    assertStructureMatches(enVal[k], locVal[k], `${dotPath}.${k}`)
  }
}

describe('_locales messages.json', () => {
  const codes = listLocaleCodes()
  expect(codes).toContain(CANONICAL_LOCALE)

  const canonical = loadMessages(CANONICAL_LOCALE)
  const canonicalKeys = sorted(Object.keys(canonical))

  it('canonical en file has message + description on every entry', () => {
    for (const key of canonicalKeys) {
      const entry = canonical[key]
      expect(entry).not.toBeNull()
      expect(typeof entry).toBe('object')
      expect(Array.isArray(entry)).toBe(false)
      const o = entry as Record<string, Json>
      expect(typeof o.message).toBe('string')
      expect(typeof o.description).toBe('string')
    }
  })

  for (const locale of codes) {
    if (locale === CANONICAL_LOCALE) {
      continue
    }

    it(`${locale}: matches ${CANONICAL_LOCALE} (keys, shape, placeholder tokens)`, () => {
      let loc: Record<string, Json>
      try {
        loc = loadMessages(locale)
      } catch (e) {
        throw new Error(`${locale}: invalid JSON — ${String(e)}`)
      }
      const locKeys = sorted(Object.keys(loc))
      expect(locKeys).toEqual(canonicalKeys)

      for (const key of canonicalKeys) {
        assertStructureMatches(canonical[key], loc[key], key)
      }

      for (const key of canonicalKeys) {
        const enEntry = canonical[key] as Record<string, Json>
        const locEntry = loc[key] as Record<string, Json>
        const locMsg = locEntry.message
        if (typeof enEntry.message !== 'string' || typeof locMsg !== 'string') {
          continue
        }
        const a = tokenSets(enEntry.message)
        const b = tokenSets(locMsg)
        expect(b.dollar).toEqual(a.dollar)
        expect(b.brace).toEqual(a.brace)
      }
    })
  }
})
