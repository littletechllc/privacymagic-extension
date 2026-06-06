const textDecoder = new TextDecoder()

export const fromBase64url = (s: string): string => {
  return textDecoder.decode(Uint8Array.fromBase64(s, { alphabet: 'base64url' }))
}

export const jsonFromBase64 = (s: string): unknown => {
  return JSON.parse(fromBase64url(s))
}
