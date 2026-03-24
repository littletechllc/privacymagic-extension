const defineMockProperty = (proto: object, name: string, value: unknown): void => {
  Object.defineProperty(proto, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true
  })
}

export const defineMockProperties = (proto: object, map: Record<string, unknown>): void => {
  for (const [name, value] of Object.entries(map)) {
    defineMockProperty(proto, name, value)
  }
}