/** Node-only base64url encode for filter-list build tools (Buffer). Decode lives in @src/common/base64 for the extension. */

export const toBase64Url = (s: string): string => {
  return Buffer.from(s, 'utf8').toString('base64url')
}

export const jsonToBase64Url = (obj: unknown): string => {
  return toBase64Url(JSON.stringify(obj))
}
