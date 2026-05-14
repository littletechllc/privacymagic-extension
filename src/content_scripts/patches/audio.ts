import { GlobalScope } from '@src/content_scripts/helpers/globalObject';
import { createSafeGetter, createSafeMethod, redefineMethods, redefinePrototypeFields, modifyConstructorArguments } from '../helpers/monkey-patch';

const audio = (globalObject: GlobalScope): void => {
  // Constants
  const NUMBER_OF_FLOAT_BITS_TO_ERASE = 12
  const NUMBER_OF_UINT8_BITS_TO_ERASE = 2
  const SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE = 48000

  // Helper functions
  const FLOAT_MASK = (0xFFFFFFFF << NUMBER_OF_FLOAT_BITS_TO_ERASE) >>> 0
  const quantizeFloat32Array = (floatData: Float32Array): void => {
    // Create the bit-manipulation view
    const uintData = new Uint32Array(
      floatData.buffer,
      floatData.byteOffset,
      floatData.length
    )
    // Quantize the entire buffer
    for (let i = 0; i < uintData.length; i++) {
      uintData[i] &= FLOAT_MASK
    }
  }
  const quantizeFloat32 = (float: number): number => {
    const floatData = new Float32Array([float])
    const uintData = new Uint32Array(floatData.buffer, floatData.byteOffset, floatData.length)
    uintData[0] &= FLOAT_MASK
    return floatData[0]
  }
  const UINT8_MASK = (0xFF << NUMBER_OF_UINT8_BITS_TO_ERASE) >>> 0
  const quantizeUint8Array = (uintData: Uint8Array): void => {
    for (let i = 0; i < uintData.length; i++) {
      uintData[i] &= UINT8_MASK
    }
  }

  // AudioBuffer.getChannelData, AudioBuffer.copyFromChannel
  const originalGetChannelData = createSafeMethod(globalObject.AudioBuffer, 'getChannelData')
  const originalCopyFromChannel = createSafeMethod(globalObject.AudioBuffer, 'copyFromChannel')
  redefineMethods(globalObject.AudioBuffer.prototype, {
    getChannelData: function (
      this: AudioBuffer,
      channel: number
    ): Float32Array<ArrayBuffer> {
      const data = originalGetChannelData(this, channel)
      quantizeFloat32Array(data)
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
      quantizeFloat32Array(tempBuffer)
      // There's a risk that the destination buffer is longer than
      // the bytes copied from the source buffer, and because we used
      // the temporary buffer, the remaining bytes will be zeroed.
      // For now this is a WONTFIX.
      destination.set(tempBuffer)
    }
  })

  // AnalyserNode
  const originalGetFloatFrequencyData = createSafeMethod(globalObject.AnalyserNode, 'getFloatFrequencyData')
  const originalGetFloatTimeDomainData = createSafeMethod(globalObject.AnalyserNode, 'getFloatTimeDomainData')
  const originalGetByteFrequencyData = createSafeMethod(globalObject.AnalyserNode, 'getByteFrequencyData')
  const originalGetByteTimeDomainData = createSafeMethod(globalObject.AnalyserNode, 'getByteTimeDomainData')
  redefineMethods(globalObject.AnalyserNode.prototype, {
    getFloatFrequencyData: function (this: AnalyserNode, array: Float32Array): void {
      const tempArray = new Float32Array(array.length)
      originalGetFloatFrequencyData(this, tempArray)
      quantizeFloat32Array(tempArray)
      array.set(tempArray)
    },
    getFloatTimeDomainData: function (this: AnalyserNode, array: Float32Array): void {
      const tempArray = new Float32Array(array.length)
      originalGetFloatTimeDomainData(this, tempArray)
      quantizeFloat32Array(tempArray)
      array.set(tempArray)
    },
    getByteFrequencyData: function (this: AnalyserNode, array: Uint8Array): void {
      const tempArray = new Uint8Array(array.length)
      originalGetByteFrequencyData(this, tempArray)
      quantizeUint8Array(tempArray)
      array.set(tempArray)
    },
    getByteTimeDomainData: function (this: AnalyserNode, array: Uint8Array): void {
      const tempArray = new Uint8Array(array.length)
      originalGetByteTimeDomainData(this, tempArray)
      quantizeUint8Array(tempArray)
      array.set(tempArray)
    }
  })

  // DynamicsCompressorNode.reduction
  const originalGetReduction = createSafeGetter(globalObject.DynamicsCompressorNode, 'reduction')
  redefinePrototypeFields(globalObject.DynamicsCompressorNode, {
    reduction: function (this: DynamicsCompressorNode): number {
      return quantizeFloat32(originalGetReduction(this))
    }
  })

  // AudioContext.sampleRate
  modifyConstructorArguments(globalObject, 'AudioContext', (options?: AudioContextOptions): [AudioContextOptions] => {
    return [{ ...options, sampleRate: SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE }]
  })

  // TODO: AudioWorklet
}

export default audio