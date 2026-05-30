import { jsonFromBase64 } from "@src/common/base64"
import { PROCEDURAL_FILTERS_COOKIE_KEY } from "@src/common/setting-ids"
import { observeSubtreeMutations, queryCssSelectorAll, splitAtFirst } from './filter-util'

/** OUTER:has(INNER:has-text(text)) */
const nestedHasHasTextMatch =
  /^(.+):has\((.+):has-text\((\/(?:\\.|[^/])+\/|[^)]+)\)\)$/

/** SUBJECT:has-text(text) */
const topLevelHasTextMatch =
  /^(.+):has-text\((\/(?:\\.|[^/])+\/|[^)]+)\)$/

export type ProceduralFilter = {
  outer?: string
  inner: string
  text: string
}

const parseProceduralSelector = (selector: string): ProceduralFilter | undefined => {
  const nested = selector.match(nestedHasHasTextMatch)
  if (nested !== null) {
    return { outer: nested[1], inner: nested[2], text: nested[3] }
  }
  const topLevel = selector.match(topLevelHasTextMatch)
  if (topLevel !== null) {
    return { inner: topLevel[1], text: topLevel[2] }
  }
  return undefined
}

const matchesText = (elementText: string, matchText: string): boolean => {
  if (matchText.startsWith('/') && matchText.endsWith('/')) {
    try {
      return new RegExp(matchText.slice(1, -1)).test(elementText)
    } catch {
      return false
    }
  }
  return elementText.includes(matchText)
}

export const queryProceduralSelectorAll = (root: Element, filter: ProceduralFilter): Element[] => {
  if (filter.outer === undefined) {
    return queryCssSelectorAll(root, filter.inner).filter(element =>
      matchesText(element.textContent ?? '', filter.text)
    )
  }
  const matched: Element[] = []
  for (const outerElement of queryCssSelectorAll(root, filter.outer)) {
    for (const innerElement of queryCssSelectorAll(outerElement, filter.inner)) {
      if (matchesText(innerElement.textContent ?? '', filter.text)) {
        matched.push(outerElement)
        break
      }
    }
  }
  return matched
}

const appendStyleToElementIfNotPresent = (element: Element, style: string) => {
  const originalStyle = element.getAttribute('style')
  if (originalStyle?.includes(style)) {
    return
  }
  const newStyle = originalStyle ? originalStyle + ';' + style : style
  element.setAttribute('style', newStyle)
}

type ActiveProceduralFilter = {
  filter: ProceduralFilter
  style: string
}

const applyProceduralFilter = (root: Element, filter: ProceduralFilter, style: string) => {
  queryProceduralSelectorAll(root, filter).forEach(element => {
    appendStyleToElementIfNotPresent(element, style)
  })
}

const applyProceduralFilters = (root: Element, activeFilters: ActiveProceduralFilter[]) => {
  for (const { filter, style } of activeFilters) {
    applyProceduralFilter(root, filter, style)
  }
}

const getProceduralFilters = (): string[][] | undefined => {
  for (const cookie of document.cookie.split(';')) {
    const [key, value] = splitAtFirst(cookie.trim(), '=')
    if (key.trim() === PROCEDURAL_FILTERS_COOKIE_KEY) {
      try {
        return jsonFromBase64(value.trim()) as string[][]
      } catch (error) {
        console.error('error parsing procedural filters:', error)
        return undefined
      }
    }
  }
  return undefined
}

const clearCookieProceduralFilters = (): void => {
  document.cookie = `${PROCEDURAL_FILTERS_COOKIE_KEY}=; Secure; SameSite=None; Path=/; Partitioned`
}

export const activateProceduralFilters = () => {
  const filters = getProceduralFilters()
  clearCookieProceduralFilters()
  if (filters === undefined) {
    return
  }

  const activeFilters: ActiveProceduralFilter[] = []
  for (const [selector, style] of filters) {
    const filter = parseProceduralSelector(selector)
    if (filter === undefined) {
      console.log('unsupported procedural filter:', selector)
      continue
    }
    activeFilters.push({ filter, style })
  }
  if (activeFilters.length === 0) {
    return
  }

  applyProceduralFilters(document.documentElement, activeFilters)
  observeSubtreeMutations((node: Element) => {
    applyProceduralFilters(node, activeFilters)
  })
}
