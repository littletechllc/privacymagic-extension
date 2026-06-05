const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export const fromBase64url = (s: string): string => {
  return textDecoder.decode(Uint8Array.fromBase64(s, { alphabet: 'base64url' }))
}

export const jsonFromBase64 = (s: string): unknown => {
  return JSON.parse(fromBase64url(s))
}

export const toBase64Url = (s: string): string => {
  const array = textEncoder.encode(s)
  return array.toBase64({ alphabet: 'base64url' })
}

export const jsonToBase64Url = (obj: unknown): string => {
  return toBase64Url(JSON.stringify(obj))
}
