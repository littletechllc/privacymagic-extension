import { createSafeMethod, objectDefinePropertiesSafe } from '@src/content_scripts/helpers/monkey-patch'
import { compileCss, compileRemoteCss, getPendingRemoteStyleSheets } from './css_helpers/css-compiler'
import { sanitizeStyleSheetsReplace } from './css_helpers/sanitizer'

type CSSElement = HTMLStyleElement | HTMLLinkElement | SVGStyleElement
type CSSElementConstructor = typeof HTMLStyleElement | typeof HTMLLinkElement | typeof SVGStyleElement
type DocumentOrShadowRoot = Document | ShadowRoot

const css = (): void => {
  if (self.HTMLStyleElement === undefined) {
    // We are likely in a worker context.
    return
  }

  let addShadowRoot: (shadowRoot: DocumentOrShadowRoot) => void = () => {}

  document.documentElement.style.visibility = 'hidden'
  const noTransitionsStyleElement = document.createElement('style')
  noTransitionsStyleElement.textContent = `
    * {
      transition: none !important;
    }
  `
  document.documentElement.appendChild(noTransitionsStyleElement)

  const attachShadowSafe = createSafeMethod(self.Element, 'attachShadow')
  const shadowRoots = new Set<DocumentOrShadowRoot>([document])
  objectDefinePropertiesSafe(self.Element.prototype, {
    attachShadow: {
      value (this: Element, init: ShadowRootInit) {
        const shadowRoot = attachShadowSafe(this, init)
        addShadowRoot(shadowRoot)
        return shadowRoot
      }
    }
  })

  const triggerOnLoadForLinkElement = (link: HTMLLinkElement): void => {
    link.dispatchEvent(new Event('load'))
  }

  const maybeWrapWithMediaQuery = (css: string, mediaAttribute: string): string => {
    if (css == null ||
      css === '') {
      return ''
    }
    if (mediaAttribute == null ||
      mediaAttribute === '') {
      return css
    }
    return `@media ${mediaAttribute} { ${css} }`
  }

  const applyCompiledContentToStyleSheet = (styleSheet: CSSStyleSheet, compiledContent: string, mediaAttribute: string, onloadCallback?: () => void): void => {
    const compiledContentWithMediaQuery = maybeWrapWithMediaQuery(compiledContent, mediaAttribute)
    styleSheet.replaceSync(compiledContentWithMediaQuery)
    if (onloadCallback != null) {
      onloadCallback()
    }
  }

  const applyLocalContentToStyleSheet = async (styleSheet: CSSStyleSheet, cssText: string, mediaAttribute: string, baseURL: string, onloadCallback?: () => void): Promise<void> => {
    let compiledContent: string
    if (cssText.includes('@import')) {
      compiledContent = await compileCss(cssText, baseURL)
    } else {
      // No imports, so we can keep this synchronous to satisify assumptions
      // on some web pages, for example nytimes.com and theguardian.com.
      compiledContent = cssText
    }
    applyCompiledContentToStyleSheet(styleSheet, compiledContent, mediaAttribute, onloadCallback)
  }

  const applyRemoteContentToStyleSheet = async (styleSheet: CSSStyleSheet, href: string, mediaAttribute: string, onloadCallback: () => void): Promise<void> => {
    const compiledContent = await compileRemoteCss(href, self.location.href)
    applyCompiledContentToStyleSheet(styleSheet, compiledContent, mediaAttribute, onloadCallback)
  }

  // Create a style sheet containing the CSS content of a link element.
  const createStyleSheetForLinkElement = (linkElement: HTMLLinkElement): CSSStyleSheet => {
    const styleSheet = new CSSStyleSheet()
    void applyRemoteContentToStyleSheet(styleSheet, linkElement.href, linkElement.media,
                                   () => triggerOnLoadForLinkElement(linkElement))
    styleSheet.disabled = linkElement.disabled
    return styleSheet
  }

  // Create a style sheet containing the CSS content of a style element.
  const createStyleSheetForStyleElement = (styleElement: HTMLStyleElement): CSSStyleSheet => {
    const styleSheet = new CSSStyleSheet()
    void applyLocalContentToStyleSheet(styleSheet, styleElement.textContent ?? '', styleElement.media, self.location.href)
    styleSheet.disabled = styleElement.disabled
    return styleSheet
  }

  // Create a style sheet containing the CSS content of a SVG style element.
  // The style sheet has a root CSS selector scoping the CSS content to the
  // SVG element.
  const createStyleSheetForSvgStyleElement = (svgStyleElement: SVGStyleElement): CSSStyleSheet => {
    const styleSheet = new CSSStyleSheet()
    const svg = svgStyleElement.closest('svg')
    if (svg === null) {
      throw new Error('svg style element does not have an ancestor svg element')
    }
    const svgId = crypto.randomUUID()
    svg.setAttribute('data-svg-id', svgId)
    const text = `[data-svg-id="${svgId}"] { ${svgStyleElement.textContent ?? ''} }`
    void applyLocalContentToStyleSheet(styleSheet, text, svgStyleElement.media, self.location.href)
    styleSheet.disabled = svgStyleElement.disabled
    return styleSheet
  }

  const getRootNode = (cssElement: CSSElement): DocumentOrShadowRoot | undefined => {
    if (cssElement == null) {
      return undefined
    }
    const root = cssElement.getRootNode()
    if (root === cssElement) {
      return undefined
    }
    if (root instanceof Document || root instanceof ShadowRoot) {
      return root
    }
    throw new Error(`unknown root node type: ${typeof root}`)
  }

  const mapGetSafe = createSafeMethod(Map, 'get')

  const styleSheetsForCssElements: Map<CSSElement, CSSStyleSheet> = new Map()

  // Get the style sheet for a style element, creating it if it doesn't exist.
  const getStyleSheetForCssElement = (cssElement: CSSElement): CSSStyleSheet | undefined => {
    const sheet = mapGetSafe(styleSheetsForCssElements, cssElement)
    if (sheet != null) {
      return sheet
    }
    let styleSheet
    if (cssElement instanceof HTMLLinkElement) {
      if (cssElement.rel === 'stylesheet') {
        styleSheet = createStyleSheetForLinkElement(cssElement)
      } else {
        return undefined
      }
    } else if (cssElement instanceof HTMLStyleElement) {
      styleSheet = createStyleSheetForStyleElement(cssElement)
    } else if (cssElement instanceof SVGStyleElement) {
      styleSheet = createStyleSheetForSvgStyleElement(cssElement)
    } else {
      throw new Error(`unknown CSS element type: ${String(cssElement)}`)
    }
    styleSheetsForCssElements.set(cssElement, styleSheet)
    const root = getRootNode(cssElement)
    if (root === undefined) {
      return undefined
    }
    // TODO: Make sure the style element is inserted in the correct position in the adopted style sheets.
    root.adoptedStyleSheets.push(styleSheet)
    return styleSheet
  }

  let frameCount = 0

  const updateStyleSheetsForRoot = (root: DocumentOrShadowRoot): void => {
    const cssElements: CSSElement[] = Array.from(root.querySelectorAll('style, link[rel="stylesheet"]'))
    if (cssElements.some(element => !styleSheetsForCssElements.has(element))) {
      const currentStyleSheets = cssElements.map(getStyleSheetForCssElement).filter(sheet => sheet !== undefined)
      const adopted = root.adoptedStyleSheets
      if (currentStyleSheets.length !== adopted.length ||
          currentStyleSheets.some((sheet, index) => sheet !== adopted[index])) {
        root.adoptedStyleSheets = currentStyleSheets
      }
    }
    const preloadLinks = root.querySelectorAll('link[rel="preload"][as="style"]')
    const preloadLinkElements = Array.from(preloadLinks) as HTMLLinkElement[];
    preloadLinkElements.forEach(triggerOnLoadForLinkElement)
  }

  // Ensure there is a style sheet for each style and link element
  // in the document's adopted style sheets.
  // We don't use a MutationObserver for the addition of new style
  // elements because it would be too slow and cause a FOUC.
  const updateAdoptedStyleSheetsToMatchCssElements = (): void => {
    shadowRoots.forEach(updateStyleSheetsForRoot)
    if ((frameCount === 3 && getPendingRemoteStyleSheets() === 0) ||
      frameCount === 10) {
      document.documentElement.style.visibility = 'visible'
      noTransitionsStyleElement.remove()
    }
    frameCount++
    self.requestAnimationFrame(updateAdoptedStyleSheetsToMatchCssElements)
  }

  // Use a MutationObserver to watch for changes to the CSS content or
  // media attribute of existing style elements. Whenever a change is
  // observed, update the corresponding adopted style sheet to match
  // the new CSS content or media attribute.
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      const el = record.target
      if (record.type === 'characterData' &&
        el.parentElement instanceof HTMLStyleElement &&
        record.oldValue !== el.parentElement.textContent) {
        const styleSheet = getStyleSheetForCssElement(el.parentElement)
        if (styleSheet !== undefined) {
          void applyLocalContentToStyleSheet(styleSheet, el.parentElement.textContent ?? '', el.parentElement.media, self.location.href)
        }
      } else if (el instanceof HTMLStyleElement &&
                 record.type === 'attributes' &&
                 record.attributeName === 'media' &&
                 record.oldValue !== el.media) {
        const styleSheet = getStyleSheetForCssElement(el)
        if (styleSheet !== undefined) {
          void applyLocalContentToStyleSheet(styleSheet, el.textContent ?? '', el.media, self.location.href)
        }
      } else if (el instanceof HTMLLinkElement &&
                 record.type === 'attributes' &&
                 ((record.attributeName === 'href' &&
                 record.oldValue !== el.href) ||
                 (record.attributeName === 'media' &&
                  record.oldValue !== el.media) ||
                 (record.attributeName === 'rel' &&
                  record.oldValue !== el.rel))) {
        const styleSheet = getStyleSheetForCssElement(el)
        if (styleSheet !== undefined) {
          void applyRemoteContentToStyleSheet(styleSheet, el.href, el.media, () => triggerOnLoadForLinkElement(el))
        }
      } else if ((el instanceof HTMLLinkElement || el instanceof HTMLStyleElement) &&
                  record.type === 'attributes' &&
                  record.attributeName === 'disabled') {
        const styleSheet = getStyleSheetForCssElement(el)
        if (styleSheet !== undefined && styleSheet.disabled !== el.disabled) {
          styleSheet.disabled = el.disabled
        }
      } else if (record.type === 'childList' && record.removedNodes.length > 0) {
        const removedNodes = Array.from(record.removedNodes)
          .filter(node => node instanceof HTMLStyleElement || node instanceof HTMLLinkElement)
          const styleSheets = removedNodes.map(node => getStyleSheetForCssElement(node)).filter(sheet => sheet !== undefined)
          removedNodes.forEach(node => styleSheetsForCssElements.delete(node))
          const root = getRootNode(removedNodes[0])
        if (root !== undefined) {
          root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => !styleSheets.includes(sheet))
        }
      }
      if (record.type === 'childList' && record.addedNodes.length > 0) {
        const addedNodes = Array.from(record.addedNodes)
        addedNodes.forEach(node => {
          if (node instanceof Element) {
            // If there's a shadow root, add it to the shadow roots set.
            const shadowRoot = node.shadowRoot
            if (shadowRoot != null) {
              addShadowRoot(shadowRoot)
            }
            // Dispatch a load event for blocked preload link elements to trigger onload scripts.
            if (node instanceof HTMLLinkElement && node.rel === 'preload' && node.as === 'style') {
              triggerOnLoadForLinkElement(node)
            }
          }
        })
      }
    }
  })

  const observeRoot = (root: DocumentOrShadowRoot): void => {
    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'media', 'href', 'rel'],
      characterData: true,
      attributeOldValue: true,
      characterDataOldValue: true
    })

    // TODO: Don't use setInterval/querySelectorAll if we can figure out a better way.
    let count = 0
    const interval = setInterval(() => {
      count++
      root.querySelectorAll('*').forEach(element => {
        const shadowRoot = element.shadowRoot
        if (shadowRoot != null) {
          addShadowRoot(shadowRoot)
        }
      })
      if (count >= 4) {
        clearInterval(interval)
      }
    }, 250)
  }

  observeRoot(document)

  addShadowRoot = (shadowRoot: DocumentOrShadowRoot): void => {
    if (shadowRoots.has(shadowRoot)) {
      return
    }
    shadowRoots.add(shadowRoot)
    updateStyleSheetsForRoot(shadowRoot)
    observeRoot(shadowRoot)
  }

  updateAdoptedStyleSheetsToMatchCssElements()

  const addEventListenerSafe = createSafeMethod(EventTarget, 'addEventListener')

  // Fix the API behavior of CSS elements so they
  // behave normally even though they have been blocked
  // from rendering CSS directly.
  const fixCssElementApiBehavior = (element: CSSElementConstructor): void => {
    objectDefinePropertiesSafe(element.prototype, {
      // CSSElement.sheet should return the adopted style
      // sheet we have created for the style element.
      sheet: {
        get: function (this: CSSElement) {
          return getStyleSheetForCssElement(this)
        }
      },
      // Don't dispatch error events because we have blocked
      // CSS loading via CSP.
      onerror: {
        set: function (this: CSSElement, _value: (this: CSSElement) => void) {
          // ignore for now
          // TODO: Handle onerror setter
        },
        get: function (this: CSSElement) {
          // ignore for now
          // TODO: Handle onerror getter
          return undefined
        },
        configurable: true
      },
      addEventListener: {
        value: function (this: CSSElement, type: string, _listener: EventListenerOrEventListenerObject, _options: boolean | AddEventListenerOptions) {
          if (type === 'error') {
            // ignore for now
            // TODO: Handle 'error' event
          } else {
            addEventListenerSafe(this, type, _listener, _options)
          }
        },
        configurable: true
      }
    })
  }
  [HTMLStyleElement, HTMLLinkElement, SVGStyleElement].forEach(fixCssElementApiBehavior)


  sanitizeStyleSheetsReplace()
}

export default css
