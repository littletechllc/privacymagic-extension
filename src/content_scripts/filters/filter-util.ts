export const queryCssSelectorAll = (root: Element, selector: string): Element[] => {
  try {
    const result: Element[] = []
    if (root.matches(selector)) {
      result.push(root)
    }
    result.push(...Array.from(root.querySelectorAll(selector)))
    return result
  } catch {
    return []
  }
}

export const splitAtFirst = (s: string, separator: string): [string, string] => {
  const index = s.indexOf(separator)
  if (index === -1) {
    return [s, '']
  }
  return [s.substring(0, index), s.substring(index + separator.length)]
}
