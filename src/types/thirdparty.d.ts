// Type declarations for npm packages

declare module 'punycode-npm' {
  const punycode: {
    toUnicode: (domain: string) => string
    toASCII: (domain: string) => string
  }
  export default punycode
}
