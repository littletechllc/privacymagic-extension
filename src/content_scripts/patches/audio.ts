import { GlobalScope } from '@src/content_scripts/helpers/globalObject';
import { createSafeGetter, createSafeMethod, redefineMethods, redefinePrototypeFields, modifyConstructorArguments } from '../helpers/monkey-patch';

const audio = (globalObject: GlobalScope): void => {
  // Constants
  const NUMBER_OF_BITS_TO_ERASE = 12
  const SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE = 48000
  // Implementation follows
  const MASK = (0xFFFFFFFF << NUMBER_OF_BITS_TO_ERASE) >>> 0
  const quantizeFloat32Array = (floatData: Float32Array): void => {
    // Create the bit-manipulation view
    const uintData = new Uint32Array(
      floatData.buffer,
      floatData.byteOffset,
      floatData.length
    )
    // Quantize the entire buffer
    for (let i = 0; i < uintData.length; i++) {
      uintData[i] &= MASK
    }
  }
  const quantizeFloat32 = (float: number): number => {
    const floatData = new Float32Array([float])
    const uintData = new Uint32Array(floatData.buffer, floatData.byteOffset, floatData.length)
    uintData[0] &= MASK
    return floatData[0]
  }
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
  const originalGetReduction = createSafeGetter(globalObject.DynamicsCompressorNode, 'reduction')
  redefinePrototypeFields(globalObject.DynamicsCompressorNode, {
    reduction: function (this: DynamicsCompressorNode): number {
      return quantizeFloat32(originalGetReduction(this))
    }
  })
  modifyConstructorArguments(globalObject, 'AudioContext', (options?: AudioContextOptions): [AudioContextOptions] => {
    return [{ ...options, sampleRate: SPOOFED_AUDIO_CONTEXT_SAMPLE_RATE }]
  })
}

export default audio