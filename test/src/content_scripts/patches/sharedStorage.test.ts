import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import sharedStorage from '@src/content_scripts/patches/sharedStorage'

const selfObj = self as unknown as Record<string, unknown>

describe('sharedStorage patch', () => {
  let originalSharedStorage: unknown

  beforeEach(() => {
    originalSharedStorage = selfObj.SharedStorage
    selfObj.SharedStorage = class SharedStorage {}
  })

  afterEach(() => {
    if (originalSharedStorage !== undefined) {
      selfObj.SharedStorage = originalSharedStorage
    } else {
      delete selfObj.SharedStorage
    }
  })

  describe('without patch', () => {
    it('should expose SharedStorage', () => {
      expect(self.SharedStorage).toBeDefined()
      expect(self.SharedStorage).toBe(selfObj.SharedStorage)
    })
  })

  describe('with patch enabled', () => {
    beforeEach(() => {
      sharedStorage()
    })

    it('should remove SharedStorage from self', () => {
      expect(self.SharedStorage).toBeUndefined()
    })
  })
})
