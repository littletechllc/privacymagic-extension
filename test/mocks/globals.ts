// Polyfills for common globals that may not be available in the test environment

// Polyfill for structuredClone if not available
if (global.structuredClone === undefined) {
  global.structuredClone = <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj)) as T
  }
}
