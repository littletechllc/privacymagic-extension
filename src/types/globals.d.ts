export {}

declare global {
  // Build-time globals injected by our esbuild config.
   
  var __disabledSettings: string[]
   
  var __PRIVACY_MAGIC_INJECT__: (disabledSettings: string[]) => void
}
