export {}

declare global {
  // Build-time globals injected by Rollup
   
  var __disabledSettings: string[]
   
  var __PRIVACY_MAGIC_INJECT__: (disabledSettings: string[]) => void
}
