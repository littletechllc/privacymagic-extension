let value : string | undefined = undefined
export const sharedSecret = () => {
  if (value !== undefined) {
    return value
  }
  if (self.document === undefined) {
    return undefined
  }
  if (document.documentElement.dataset.sharedSecret === undefined) {
    value = crypto.randomUUID()
    document.documentElement.dataset.sharedSecret = value
    return value
  } else {
    value = document.documentElement.dataset.sharedSecret
    document.documentElement.dataset.sharedSecret = undefined
    return value
  }
}