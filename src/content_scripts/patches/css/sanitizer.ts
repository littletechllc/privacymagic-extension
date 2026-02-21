import { getDisabledSettings } from '@src/content_scripts/helpers/helpers'
import { createSafeMethod, objectDefinePropertiesSafe } from '@src/content_scripts/helpers/monkey-patch'
import { sanitizeFontFaceSource } from './font-face'

/**
 * Sanitize a font face rule by replacing any invalid local font names
 * that are not in the allowlist with an empty Data URI.
 * @param rule - The font face rule to sanitize.
 */
const sanitizeFontFaceRule = (rule: CSSFontFaceRule): void => {
  const src = rule.style.getPropertyValue('src')
  const sanitizedSrc = sanitizeFontFaceSource(src)
  if (sanitizedSrc !== src) {
    rule.style.setProperty('src', sanitizedSrc)
  }
}

const isFontSettingDisabled = getDisabledSettings().includes('fonts')

/**
 * Sanitize a single CSS rule by modifying leaky CSS rules.
 * @param rule - The CSS rule to sanitize.
 * @returns The sanitized CSS rule.
 */
const sanitizeRule = (rule: CSSRule): void => {
  if (rule instanceof CSSMediaRule) {
    rule.media.mediaText = rule.media.mediaText.replace(/device-width/g, 'width').replace(/device-height/g, 'height')
  }
  if (rule instanceof CSSFontFaceRule && !isFontSettingDisabled) {
    sanitizeFontFaceRule(rule)
  }
  if (rule instanceof CSSGroupingRule) {
    for (const childRule of Array.from(rule.cssRules)) {
      sanitizeRule(childRule)
    }
  }
}

/**
 * Sanitize the style sheet in place by modifying leaky CSS rules.
 * @param styleSheet - The style sheet to sanitize.
 */
const sanitizeStyleSheet = (styleSheet: CSSStyleSheet): void => {
  try {
    const rules = Array.from(styleSheet.cssRules)
    rules.forEach(rule => sanitizeRule(rule))
  } catch (error) {
    console.error('error sanitizing style sheet', error)
  }
}

export const sanitizeStyleSheetsReplace = () => {
  const replaceSyncSafe = createSafeMethod(CSSStyleSheet, 'replaceSync')
  const replaceSafe = createSafeMethod(CSSStyleSheet, 'replace')
  objectDefinePropertiesSafe(CSSStyleSheet.prototype, {
    replaceSync: {
      value(this: CSSStyleSheet, css: string) {
        replaceSyncSafe(this, css)
        sanitizeStyleSheet(this)
      }
    },
    replace: {
      async value(this: CSSStyleSheet, css: string) {
        await replaceSafe(this, css)
        sanitizeStyleSheet(this)
      }
    }
  })
}