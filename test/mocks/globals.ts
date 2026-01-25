// Polyfills for common globals that may not be available in the test environment

// Polyfill for structuredClone if not available
if (global.structuredClone === undefined) {
  global.structuredClone = <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj)) as T
  }
}

// Polyfill for TextEncoder if not available
if (global.TextEncoder === undefined) {
  global.TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      const bytes: number[] = []
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)
        if (code < 0x80) {
          bytes.push(code)
        } else if (code < 0x800) {
          bytes.push(0xc0 | (code >> 6))
          bytes.push(0x80 | (code & 0x3f))
        } else if (code < 0xd800 || code >= 0xe000) {
          bytes.push(0xe0 | (code >> 12))
          bytes.push(0x80 | ((code >> 6) & 0x3f))
          bytes.push(0x80 | (code & 0x3f))
        } else {
          // Surrogate pair
          i++
          const code2 = str.charCodeAt(i)
          const codePoint = 0x10000 + (((code & 0x3ff) << 10) | (code2 & 0x3ff))
          bytes.push(0xf0 | (codePoint >> 18))
          bytes.push(0x80 | ((codePoint >> 12) & 0x3f))
          bytes.push(0x80 | ((codePoint >> 6) & 0x3f))
          bytes.push(0x80 | (codePoint & 0x3f))
        }
      }
      return new Uint8Array(bytes)
    }
  } as typeof TextEncoder
}
