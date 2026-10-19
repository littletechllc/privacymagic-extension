/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

const FLOAT_BITS_TO_NOISE = 12
const FLOAT_MASK = (0xFFFFFFFF << FLOAT_BITS_TO_NOISE) >>> 0

async function runProbe () {
  if (typeof AudioContext !== 'function') {
    throw new Error('AudioContext is unavailable')
  }
  const context = new AudioContext({ sampleRate: 44100 })
  try {
    const written = new Float32Array(8)
    for (let i = 0; i < written.length; i += 1) {
      written[i] = (i + 1) * 1.23456789
    }
    const buffer = context.createBuffer(1, written.length, context.sampleRate)
    buffer.copyToChannel(written, 0)
    const read = buffer.getChannelData(0)
    const writtenBits = new Uint32Array(written.buffer, written.byteOffset, written.length)
    const readBits = new Uint32Array(read.buffer, read.byteOffset, read.length)
    let channelDataNoised = false
    let channelDataHighBitsPreserved = true
    for (let i = 0; i < read.length; i += 1) {
      if (read[i] !== written[i]) {
        channelDataNoised = true
      }
      if ((readBits[i] & FLOAT_MASK) !== (writtenBits[i] & FLOAT_MASK)) {
        channelDataHighBitsPreserved = false
      }
    }
    return {
      sampleRate: context.sampleRate,
      channelDataNoised,
      channelDataHighBitsPreserved
    }
  } finally {
    await context.close()
  }
}
