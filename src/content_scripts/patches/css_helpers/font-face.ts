import { stringReplaceSafe } from "@src/content_scripts/helpers/safe"
import { isAllowedFont } from "@src/common/font-filter"

const localFontRegex = /local\s*\(\s*['"]?([^'")]*?)['"]?\s*\)/gi
const emptyDataUri = 'url("data:application/font-woff2;base64,")'

export const sanitizeFontFaceSource = (source: string): string => {
  return stringReplaceSafe(source, localFontRegex, (match: string, fontName: string): string =>
    isAllowedFont(fontName) ? match : emptyDataUri)
}