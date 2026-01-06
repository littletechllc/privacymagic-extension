export {}

declare global {
  // Build-time globals injected by Rollup
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __disabledSettings: string[]
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __PRIVACY_MAGIC_INJECT__: (disabledSettings: string[]) => void
}
