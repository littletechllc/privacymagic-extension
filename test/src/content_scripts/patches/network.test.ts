import {describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import network from '@src/content_scripts/patches/network'

const leakyDownlink = 0.5
const leakyEffectiveType = '3g'
const leakyRtt = 50
const leakySaveData = true

const patchedDownlink = 100
const patchedEffectiveType = '4g'
const patchedRtt = 100
const patchedSaveData = false

class MockNetworkInformation extends EventTarget {
  get downlink(): number {
    return leakyDownlink
  }
  get effectiveType(): string {
    return leakyEffectiveType
  }
  get rtt(): number {
    return leakyRtt
  }
  get saveData(): boolean {
    return leakySaveData
  }
}

type SelfWithNetworkInformation = typeof globalThis & { NetworkInformation?: typeof MockNetworkInformation }

describe('network patch', () => {
  let originalNetworkInformation: typeof MockNetworkInformation | undefined

  const resetMockPrototypeToLeaky = (): void => {
    Object.defineProperties(MockNetworkInformation.prototype, {
      downlink: {
        configurable: true,
        enumerable: true,
        get: () => leakyDownlink
      },
      effectiveType: {
        configurable: true,
        enumerable: true,
        get: () => leakyEffectiveType
      },
      rtt: {
        configurable: true,
        enumerable: true,
        get: () => leakyRtt
      },
      saveData: {
        configurable: true,
        enumerable: true,
        get: () => leakySaveData
      }
    })
  }

  beforeEach(() => {
    const selfWith = self as unknown as SelfWithNetworkInformation
    originalNetworkInformation = selfWith.NetworkInformation
    selfWith.NetworkInformation = MockNetworkInformation
    resetMockPrototypeToLeaky()
  })

  afterEach(() => {
    const selfWith = self as unknown as SelfWithNetworkInformation
    if (originalNetworkInformation !== undefined) {
      selfWith.NetworkInformation = originalNetworkInformation
    } else {
      delete selfWith.NetworkInformation
    }
  })

  it('should be a no-op when NetworkInformation is undefined', () => {
    delete (self as unknown as SelfWithNetworkInformation).NetworkInformation

    expect(() => network(self)).not.toThrow()
  })

  describe('with patch applied', () => {
    beforeEach(() => {
      network(self)
    })

    it('should spoof downlink/effectiveType/rtt/saveData', () => {
      const instance = new MockNetworkInformation()

      expect(instance.downlink).toBe(patchedDownlink)
      expect(instance.effectiveType).toBe(patchedEffectiveType)
      expect(instance.rtt).toBe(patchedRtt)
      expect(instance.saveData).toBe(patchedSaveData)
    })
  })

  describe('without patch', () => {
    it('should expose leaky network properties', () => {
      const instance = new MockNetworkInformation()

      expect(instance.downlink).toBe(leakyDownlink)
      expect(instance.effectiveType).toBe(leakyEffectiveType)
      expect(instance.rtt).toBe(leakyRtt)
      expect(instance.saveData).toBe(leakySaveData)
    })
  })
})

