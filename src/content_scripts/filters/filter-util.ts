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

export function observeSubtreeMutations (
  onElement: (element: Element) => void,
  root: Element = document.documentElement
): MutationObserver {
  const observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element) {
            onElement(node)
          }
        }
      } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        onElement(mutation.target as Element)
      }
    }
  })
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  })
  return observer
}
