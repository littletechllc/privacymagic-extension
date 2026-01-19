// Type declarations for npm packages

declare module 'psl' {
  const psl: {
    get: (hostname: string) => string | null
  }
  export default psl
}

declare module 'punycode-npm' {
  const punycode: {
    toUnicode: (domain: string) => string
    toASCII: (domain: string) => string
  }
  export default punycode
}
