import { GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { createSafeGetter, createSafeMethod, redefineMethods, redefinePrototypeFields, modifyConstructorArguments } from '../helpers/monkey-patch'

const audio = (globalObject: GlobalScope): void => {
  // Constants
  const NUMBER_OF_FLOAT_BITS_TO_NOISE = 12
  const NUMBER_OF_UINT8_BITS_TO_NOISE = 2
  const SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE = 48000
  const CRYPTO_GET_RANDOM_VALUES_MAX_BYTES = 65536

  // Helper functions
  const FLOAT_MASK = (0xFFFFFFFF << NUMBER_OF_FLOAT_BITS_TO_NOISE) >>> 0
  const FLOAT_LOW_BITS = (~FLOAT_MASK) >>> 0
  const UINT8_MASK = (0xFF << NUMBER_OF_UINT8_BITS_TO_NOISE) >>> 0
  const UINT8_LOW_BITS = (~UINT8_MASK) & 0xFF

  const randomUint32Array = (length: number): Uint32Array => {
    const random = new Uint32Array(length)
    const bytes = new Uint8Array(random.buffer)
    const chunk = new Uint8Array(Math.min(bytes.length, CRYPTO_GET_RANDOM_VALUES_MAX_BYTES))
    for (let offset = 0; offset < bytes.length;) {
      const chunkSize = Math.min(chunk.length, bytes.length - offset)
      const slice = chunkSize === chunk.length ? chunk : chunk.subarray(0, chunkSize)
      globalObject.crypto.getRandomValues(slice)
      bytes.set(slice, offset)
      offset += chunkSize
    }
    return random
  }

  const randomUint8Array = (length: number): Uint8Array => {
    const random = new Uint8Array(length)
    const chunk = new Uint8Array(Math.min(length, CRYPTO_GET_RANDOM_VALUES_MAX_BYTES))
    for (let offset = 0; offset < length;) {
      const chunkSize = Math.min(chunk.length, length - offset)
      const slice = chunkSize === chunk.length ? chunk : chunk.subarray(0, chunkSize)
      globalObject.crypto.getRandomValues(slice)
      random.set(slice, offset)
      offset += chunkSize
    }
    return random
  }

  const noiseFloat32Array = (floatData: Float32Array): void => {
    const uintData = new Uint32Array(
      floatData.buffer,
      floatData.byteOffset,
      floatData.length
    )
    const random = randomUint32Array(uintData.length)
    for (let i = 0; i < uintData.length; i++) {
      if (!Number.isFinite(floatData[i])) {
        continue
      }
      uintData[i] = (uintData[i] & FLOAT_MASK) | (random[i] & FLOAT_LOW_BITS)
    }
  }
  const noiseFloat32 = (float: number): number => {
    const floatData = new Float32Array([float])
    noiseFloat32Array(floatData)
    return floatData[0]
  }
  const noiseUint8Array = (uintData: Uint8Array): void => {
    const random = randomUint8Array(uintData.length)
    for (let i = 0; i < uintData.length; i++) {
      uintData[i] = (uintData[i] & UINT8_MASK) | (random[i] & UINT8_LOW_BITS)
    }
  }

  // AudioBuffer.getChannelData, AudioBuffer.copyFromChannel
  if (globalObject.AudioBuffer != null) {
    const originalGetChannelData = createSafeMethod(globalObject.AudioBuffer, 'getChannelData')
    const originalCopyFromChannel = createSafeMethod(globalObject.AudioBuffer, 'copyFromChannel')
    redefineMethods(globalObject.AudioBuffer.prototype, {
      getChannelData: function (
        this: AudioBuffer,
        channel: number
      ): Float32Array<ArrayBuffer> {
        const data = originalGetChannelData(this, channel)
        noiseFloat32Array(data)
        return data
      },
      copyFromChannel: function (
        this: AudioBuffer,
        destination: Float32Array<ArrayBuffer>,
        channelNumber: number,
        startInChannel: number
      ): void {
        // We don't copy directly to the destination buffer to avoid
        // potential security issues with SharedArrayBuffers.
        const tempBuffer = new Float32Array(destination.length)
        originalCopyFromChannel(this, tempBuffer, channelNumber, startInChannel)
        noiseFloat32Array(tempBuffer)
        // There's a risk that the destination buffer is longer than
        // the bytes copied from the source buffer, and because we used
        // the temporary buffer, the remaining bytes will be zeroed.
        // For now this is a WONTFIX.
        destination.set(tempBuffer)
      }
    })
  }

  // AnalyserNode
  if (globalObject.AnalyserNode != null) {
    const originalGetFloatFrequencyData = createSafeMethod(globalObject.AnalyserNode, 'getFloatFrequencyData')
    const originalGetFloatTimeDomainData = createSafeMethod(globalObject.AnalyserNode, 'getFloatTimeDomainData')
    const originalGetByteFrequencyData = createSafeMethod(globalObject.AnalyserNode, 'getByteFrequencyData')
    const originalGetByteTimeDomainData = createSafeMethod(globalObject.AnalyserNode, 'getByteTimeDomainData')
    redefineMethods(globalObject.AnalyserNode.prototype, {
      getFloatFrequencyData: function (this: AnalyserNode, array: Float32Array): void {
        const tempArray = new Float32Array(array.length)
        originalGetFloatFrequencyData(this, tempArray)
        noiseFloat32Array(tempArray)
        array.set(tempArray)
      },
      getFloatTimeDomainData: function (this: AnalyserNode, array: Float32Array): void {
        const tempArray = new Float32Array(array.length)
        originalGetFloatTimeDomainData(this, tempArray)
        noiseFloat32Array(tempArray)
        array.set(tempArray)
      },
      getByteFrequencyData: function (this: AnalyserNode, array: Uint8Array): void {
        const tempArray = new Uint8Array(array.length)
        originalGetByteFrequencyData(this, tempArray)
        noiseUint8Array(tempArray)
        array.set(tempArray)
      },
      getByteTimeDomainData: function (this: AnalyserNode, array: Uint8Array): void {
        const tempArray = new Uint8Array(array.length)
        originalGetByteTimeDomainData(this, tempArray)
        noiseUint8Array(tempArray)
        array.set(tempArray)
      }
    })
  }

  // DynamicsCompressorNode.reduction
  if (globalObject.DynamicsCompressorNode != null) {
    const originalGetReduction = createSafeGetter(globalObject.DynamicsCompressorNode, 'reduction')
    redefinePrototypeFields(globalObject.DynamicsCompressorNode, {
      reduction: function (this: DynamicsCompressorNode): number {
        return noiseFloat32(originalGetReduction(this))
      }
    })
  }

  // AudioContext.sampleRate
  if (globalObject.AudioContext != null) {
    modifyConstructorArguments(globalObject, 'AudioContext', (options?: AudioContextOptions): [AudioContextOptions] => {
      return [{ ...options, sampleRate: SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE }]
    })
  }

  // TODO: AudioWorklet
}

export default audio