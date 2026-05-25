export const fromBase64 = (s: string): string => {
  return Buffer.from(s, 'base64').toString('utf-8')
}

export const jsonFromBase64 = (s: string): unknown => {
  return JSON.parse(fromBase64(s))
}

export const toBase64 = (s: string): string => {
  return Buffer.from(s, 'utf-8').toString('base64')
}

export const jsonToBase64 = (obj: unknown): string => {
  return toBase64(JSON.stringify(obj))
}