/**
 * Contract tests for `remote/remote.json` (same shape as `RemoteConfig` in `src/background/remote.ts`).
 * The canonical key is `setting_exceptions` (setting singular), not `settings_exceptions`.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { isValid } from 'psl'
import { describe, it, expect } from '@jest/globals'
import { ALL_SETTING_IDS, type SettingId } from '@src/common/setting-ids'

const REMOTE_JSON_PATH = join(process.cwd(), 'remote', 'remote.json')

/** Key used in repo and by `remote.ts` / `updateRemoteConfig`. */
const SETTING_EXCEPTIONS_KEY = 'setting_exceptions'

const isKnownSettingId = (key: string): key is SettingId =>
  (ALL_SETTING_IDS as readonly string[]).includes(key)

describe('remote/remote.json', () => {
  it('is valid JSON and parses to a plain object', () => {
    const raw = readFileSync(REMOTE_JSON_PATH, 'utf8')
    let parsed: unknown
    expect(() => {
      parsed = JSON.parse(raw) as unknown
    }).not.toThrow()
    expect(parsed).not.toBeNull()
    expect(typeof parsed).toBe('object')
    expect(Array.isArray(parsed)).toBe(false)
  })

  it('has setting_exceptions with only valid SettingId keys and string[] registrable domains', () => {
    const raw = readFileSync(REMOTE_JSON_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>

    expect(parsed).toHaveProperty(SETTING_EXCEPTIONS_KEY)
    const exceptions = parsed[SETTING_EXCEPTIONS_KEY]
    expect(exceptions).not.toBeNull()
    expect(typeof exceptions).toBe('object')
    expect(Array.isArray(exceptions)).toBe(false)

    const entries = Object.entries(exceptions as Record<string, unknown>)
    for (const [settingId, domains] of entries) {
      expect(isKnownSettingId(settingId)).toBe(true)

      expect(Array.isArray(domains)).toBe(true)
      for (const item of domains as unknown[]) {
        expect(typeof item).toBe('string')
        expect(isValid(item as string)).toBe(true)
      }
    }
  })
})
