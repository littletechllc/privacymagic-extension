import { describe, it, expect, beforeEach } from '@jest/globals'
import type { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import audio from '@src/content_scripts/patches/audio'

const NUMBER_OF_FLOAT_BITS_TO_ERASE = 12
const NUMBER_OF_UINT8_BITS_TO_ERASE = 2
const SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE = 48000

const FLOAT_MASK = (0xFFFFFFFF << NUMBER_OF_FLOAT_BITS_TO_ERASE) >>> 0
const UINT8_MASK = (0xFF << NUMBER_OF_UINT8_BITS_TO_ERASE) >>> 0

const leakyFloatSamples = new Float32Array([1.23456789, 2.3456789, -3.45678901])
const leakyUint8Samples = new Uint8Array([1, 17, 33, 255])
const leakyReduction = -12.3456789

function quantizeFloat32 (float: number): number {
  const floatData = new Float32Array([float])
  const uintData = new Uint32Array(floatData.buffer, floatData.byteOffset, floatData.length)
  uintData[0] &= FLOAT_MASK
  return floatData[0]
}

function quantizeFloat32Array (floatData: Float32Array): Float32Array {
  const copy = new Float32Array(floatData)
  const uintData = new Uint32Array(copy.buffer, copy.byteOffset, copy.length)
  for (let i = 0; i < uintData.length; i++) {
    uintData[i] &= FLOAT_MASK
  }
  return copy
}

function quantizeUint8Array (uintData: Uint8Array): Uint8Array {
  const copy = new Uint8Array(uintData)
  for (let i = 0; i < copy.length; i++) {
    copy[i] &= UINT8_MASK
  }
  return copy
}

class MockAudioBuffer {
  getChannelData (_channel: number): Float32Array {
    return new Float32Array(leakyFloatSamples)
  }

  copyFromChannel (
    destination: Float32Array,
    _channelNumber: number,
    _startInChannel: number
  ): void {
    destination.set(leakyFloatSamples)
  }
}

class MockAnalyserNode {
  getFloatFrequencyData (array: Float32Array): void {
    array.set(leakyFloatSamples.subarray(0, array.length))
  }

  getFloatTimeDomainData (array: Float32Array): void {
    array.set(leakyFloatSamples.subarray(0, array.length))
  }

  getByteFrequencyData (array: Uint8Array): void {
    array.set(leakyUint8Samples.subarray(0, array.length))
  }

  getByteTimeDomainData (array: Uint8Array): void {
    array.set(leakyUint8Samples.subarray(0, array.length))
  }
}

class MockDynamicsCompressorNode {
  get reduction (): number {
    return leakyReduction
  }
}

class MockAudioContext {
  readonly sampleRate: number

  constructor (options?: AudioContextOptions) {
    this.sampleRate = options?.sampleRate ?? 44100
  }
}

function makeFakeGlobalScope (overrides?: Partial<{
  AudioBuffer: GlobalScope['AudioBuffer']
  AnalyserNode: GlobalScope['AnalyserNode']
  DynamicsCompressorNode: GlobalScope['DynamicsCompressorNode']
  AudioContext: GlobalScope['AudioContext']
}>): GlobalScope {
  return {
    AudioBuffer: undefined,
    AnalyserNode: undefined,
    DynamicsCompressorNode: undefined,
    AudioContext: undefined,
    ...overrides
  } as unknown as GlobalScope
}

function makeAudioGlobalScope (): GlobalScope {
  return makeFakeGlobalScope({
    AudioBuffer: MockAudioBuffer as unknown as GlobalScope['AudioBuffer'],
    AnalyserNode: MockAnalyserNode as unknown as GlobalScope['AnalyserNode'],
    DynamicsCompressorNode: MockDynamicsCompressorNode as unknown as GlobalScope['DynamicsCompressorNode'],
    AudioContext: MockAudioContext as unknown as GlobalScope['AudioContext']
  })
}

describe('audio patch', () => {
  describe('without patch', () => {
    let fakeGlobal: GlobalScope

    beforeEach(() => {
      fakeGlobal = makeAudioGlobalScope()
    })

    it('should return unquantized AudioBuffer channel data', () => {
      const buffer = new MockAudioBuffer()
      expect([...buffer.getChannelData(0)]).toEqual([...leakyFloatSamples])
    })

    it('should return unquantized DynamicsCompressorNode.reduction', () => {
      const compressor = new MockDynamicsCompressorNode()
      expect(compressor.reduction).toBe(leakyReduction)
    })

    it('should preserve AudioContext sampleRate from constructor options', () => {
      const AudioContextCtor = fakeGlobal.AudioContext as typeof MockAudioContext
      const context = new AudioContextCtor({ sampleRate: 96000 })
      expect(context.sampleRate).toBe(96000)
    })
  })

  describe('with patch enabled', () => {
    let fakeGlobal: GlobalScope

    beforeEach(() => {
      fakeGlobal = makeAudioGlobalScope()
      audio(fakeGlobal)
    })

    it('should quantize AudioBuffer.getChannelData output', () => {
      const buffer = new MockAudioBuffer()
      const channelData = buffer.getChannelData(0)
      expect([...channelData]).toEqual([...quantizeFloat32Array(leakyFloatSamples)])
    })

    it('should quantize AudioBuffer.copyFromChannel output', () => {
      const buffer = new MockAudioBuffer()
      const destination = new Float32Array(leakyFloatSamples.length)
      buffer.copyFromChannel(destination, 0, 0)
      expect([...destination]).toEqual([...quantizeFloat32Array(leakyFloatSamples)])
    })

    it('should quantize AnalyserNode float read methods', () => {
      const analyser = new MockAnalyserNode()
      const floatFrequencyData = new Float32Array(leakyFloatSamples.length)
      const floatTimeDomainData = new Float32Array(leakyFloatSamples.length)

      analyser.getFloatFrequencyData(floatFrequencyData)
      analyser.getFloatTimeDomainData(floatTimeDomainData)

      expect([...floatFrequencyData]).toEqual([...quantizeFloat32Array(leakyFloatSamples)])
      expect([...floatTimeDomainData]).toEqual([...quantizeFloat32Array(leakyFloatSamples)])
    })

    it('should quantize AnalyserNode byte read methods', () => {
      const analyser = new MockAnalyserNode()
      const byteFrequencyData = new Uint8Array(leakyUint8Samples.length)
      const byteTimeDomainData = new Uint8Array(leakyUint8Samples.length)

      analyser.getByteFrequencyData(byteFrequencyData)
      analyser.getByteTimeDomainData(byteTimeDomainData)

      expect([...byteFrequencyData]).toEqual([...quantizeUint8Array(leakyUint8Samples)])
      expect([...byteTimeDomainData]).toEqual([...quantizeUint8Array(leakyUint8Samples)])
    })

    it('should quantize DynamicsCompressorNode.reduction', () => {
      const compressor = new MockDynamicsCompressorNode()
      expect(compressor.reduction).toBe(quantizeFloat32(leakyReduction))
    })

    it('should force AudioContext sampleRate to 48000', () => {
      const AudioContextCtor = fakeGlobal.AudioContext as typeof MockAudioContext
      const context = new AudioContextCtor({ sampleRate: 96000 })
      expect(context.sampleRate).toBe(SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE)
    })
  })

  describe('when audio APIs are not available', () => {
    it('should not throw when patch is applied', () => {
      const fakeGlobal = makeFakeGlobalScope()
      expect(() => {
        audio(fakeGlobal)
      }).not.toThrow()
    })
  })
})
