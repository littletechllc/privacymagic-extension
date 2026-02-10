import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import disk from '@src/content_scripts/patches/disk'

// StorageManager may be absent or differ in jsdom; use a minimal mock that has estimate()
class MockStorageManager {
  estimate(): Promise<{ usage: number; quota: number; usageDetails: Record<string, number> }> {
    return Promise.resolve({
      usage: 1000,
      quota: 5000,
      usageDetails: { indexedDB: 500, caches: 500 }
    })
  }
  persist(): Promise<boolean> {
    return Promise.resolve(false)
  }
  persisted(): Promise<boolean> {
    return Promise.resolve(false)
  }
  getDirectory(): Promise<FileSystemDirectoryHandle> {
    return Promise.reject(new Error('not implemented'))
  }
}

type SelfWithStorageManager = { StorageManager?: typeof MockStorageManager }

describe('disk patch', () => {
  let originalStorageManager: typeof MockStorageManager | undefined

  beforeEach(() => {
    const selfWithStorage = self as unknown as SelfWithStorageManager
    originalStorageManager = selfWithStorage.StorageManager
    selfWithStorage.StorageManager = MockStorageManager
  })

  afterEach(() => {
    const selfWithStorage = self as unknown as SelfWithStorageManager
    if (originalStorageManager !== undefined) {
      selfWithStorage.StorageManager = originalStorageManager
    } else {
      delete selfWithStorage.StorageManager
    }
  })

  describe('without patch', () => {
    it('should return original estimate values', async () => {
      const storage = new MockStorageManager()
      const result = await storage.estimate()

      expect(result.usage).toBe(1000)
      expect(result.quota).toBe(5000)
      expect(result.usageDetails).toEqual({ indexedDB: 500, caches: 500 })
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      disk()
    })

    it('should return patched usage (0)', async () => {
      const storage = new MockStorageManager()
      const result = await storage.estimate()

      expect(result.usage).toBe(0)
    })

    it('should return patched quota (2 GB)', async () => {
      const storage = new MockStorageManager()
      const result = await storage.estimate()

      expect(result.quota).toBe(2147483648)
    })

    it('should return empty usageDetails', async () => {
      const storage = new MockStorageManager()
      const result = await storage.estimate()

      expect(result.usageDetails).toEqual({})
    })
  })
})
