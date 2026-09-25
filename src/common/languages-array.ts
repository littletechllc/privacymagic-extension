// Primary language subtag, so "en-US" and "en" share "en".
const baseLanguage = (tag: string): string => tag.split('-')[0].toLowerCase()

// Keep the first language and its bare base tag (for example "en-US" and "en").
// Drop other regions of that language and every other language.
export const languagesForFirst = (languages: readonly string[]): readonly string[] => {
  const first = languages[0]
  if (first == null) {
    return languages
  }
  const base = baseLanguage(first)
  return languages.filter((tag, index) => index === 0 || tag.toLowerCase() === base)
}

// Chromium's HttpUtil::GenerateAcceptLanguageHeader. The first tag omits q
// (implicit 1.0). Each later tag decreases by 0.1, floored at 0.1.
export const acceptLanguageHeader = (languages: readonly string[]): string => {
  let qvalue10 = 10
  const parts: string[] = []
  for (const tag of languagesForFirst(languages)) {
    if (qvalue10 === 10) {
      parts.push(tag)
    } else {
      parts.push(`${tag};q=0.${qvalue10}`)
    }
    if (qvalue10 > 1) {
      qvalue10 -= 1
    }
  }
  return parts.join(',')
}
