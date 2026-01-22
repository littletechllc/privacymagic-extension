export {}

import { ContentSettingId } from "@src/common/setting-ids"

declare global {
  // Build-time globals injected by our esbuild config.

  var __disabledSettings: ContentSettingId[]

  var __PRIVACY_MAGIC_INJECT__: (disabledSettings: ContentSettingId[]) => void
}
