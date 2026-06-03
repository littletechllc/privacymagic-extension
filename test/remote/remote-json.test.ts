/**
 * Contract tests for `remote/remote.json` (same validation as `src/background/remote.ts`).
 * The canonical key is `setting_exceptions` (setting singular), not `settings_exceptions`.
 */
import '@test/mocks/web-extension'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from '@jest/globals'
import { isValidRemoteConfig, type RemoteConfig } from '@src/background/remote'

const REMOTE_JSON_PATH = join(process.cwd(), 'remote', 'remote.json')

const validMinimal = (): RemoteConfig => ({
  version: 1,
  setting_exceptions: { ads: ['example.com'] }
})

describe('remote/remote.json', () => {
  it('passes isValidRemoteConfig (same checks as background fetch)', () => {
    const raw = readFileSync(REMOTE_JSON_PATH, 'utf8')
    const parsed = JSON.parse(raw) as RemoteConfig
    expect(isValidRemoteConfig(parsed)).toBe(true)
  })
})

describe('isValidRemoteConfig', () => {
  it('accepts a minimal valid config', () => {
    expect(isValidRemoteConfig(validMinimal())).toBe(true)
  })

  it('accepts empty setting_exceptions', () => {
    expect(isValidRemoteConfig({ version: 1, setting_exceptions: {} })).toBe(true)
  })

  it('accepts optional $schema', () => {
    expect(isValidRemoteConfig({
      $schema: './schema.json',
      version: 1,
      setting_exceptions: { ads: ['example.com'] }
    })).toBe(true)
  })

  describe('rejects invalid configs', () => {
    it('null root', () => {
      expect(isValidRemoteConfig(null as unknown as RemoteConfig)).toBe(false)
    })

    it('missing version', () => {
      expect(isValidRemoteConfig({ setting_exceptions: {} } as RemoteConfig)).toBe(false)
    })

    it('null version', () => {
      expect(isValidRemoteConfig({ version: null, setting_exceptions: {} } as unknown as RemoteConfig)).toBe(false)
    })

    it('missing setting_exceptions', () => {
      expect(isValidRemoteConfig({ version: 1 } as RemoteConfig)).toBe(false)
    })

    it('null setting_exceptions', () => {
      expect(isValidRemoteConfig({ version: 1, setting_exceptions: null } as unknown as RemoteConfig)).toBe(false)
    })

    it('version is not a number', () => {
      expect(isValidRemoteConfig({ version: '1', setting_exceptions: {} } as unknown as RemoteConfig)).toBe(false)
    })

    it('version is not an integer', () => {
      expect(isValidRemoteConfig({ version: 1.5, setting_exceptions: {} })).toBe(false)
    })

    it('extra top-level key', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: {},
        extra: true
      } as unknown as RemoteConfig)).toBe(false)
    })

    it('version is zero', () => {
      expect(isValidRemoteConfig({ version: 0, setting_exceptions: {} })).toBe(false)
    })

    it('version is negative', () => {
      expect(isValidRemoteConfig({ version: -1, setting_exceptions: {} })).toBe(false)
    })

    it('setting_exceptions is an array', () => {
      expect(isValidRemoteConfig({ version: 1, setting_exceptions: [] } as unknown as RemoteConfig)).toBe(false)
    })

    it('setting_exceptions is not an object', () => {
      expect(isValidRemoteConfig({ version: 1, setting_exceptions: 'ads' } as unknown as RemoteConfig)).toBe(false)
    })

    it('unknown setting id', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: { notARealSetting: ['example.com'] }
      } as unknown as RemoteConfig)).toBe(false)
    })

    it('domains is null', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: { ads: null }
      } as unknown as RemoteConfig)).toBe(false)
    })

    it('domains is not an array', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: { ads: 'example.com' }
      } as unknown as RemoteConfig)).toBe(false)
    })

    it('domains is an empty array', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: { ads: [] }
      })).toBe(false)
    })

    it('domain is not a string', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: { ads: [123] }
      } as unknown as RemoteConfig)).toBe(false)
    })

    it('domain is not a registrable domain', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: { ads: ['not-a-domain'] }
      })).toBe(false)
    })

    it('fails when any entry is invalid (valid then bad domain)', () => {
      expect(isValidRemoteConfig({
        version: 1,
        setting_exceptions: {
          ads: ['example.com'],
          worker: ['']
        }
      })).toBe(false)
    })
  })
})
