import { createSafeGetter, createSafeMethod, objectDefinePropertiesSafe } from '@src/content_scripts/helpers/monkey-patch'
import { backgroundFetch } from '@src/content_scripts/helpers/background-fetch-main'
import { getDisabledSettings } from '../helpers/helpers'
import { sanitizeFontFaceSource } from './css_helpers/font-face'
import { stringReplaceSafe } from '../helpers/safe'

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

  const extractImportUrls = (cssText: string): { urls: string[], cssTextWithoutImports: string } => {
    const urls: string[] = []
    const regex = /@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*;/gi
    let match: RegExpExecArray | null
    match = regex.exec(cssText)
    while (match !== null) {
      urls.push(match[1])
      match = regex.exec(cssText)
    }
    const cssTextWithoutImports = cssText.replace(regex, '')
    return { urls, cssTextWithoutImports }
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

  const fetchSafe = fetch

  let pendingRemoteStyleSheets = 0

  const getRemoteStyleSheetContent = async (href: string): Promise<string> => {
    pendingRemoteStyleSheets++
    let content = ''
    try {
      const response = await fetchSafe(href)
      if (response.ok) {
        console.log('direct fetch successful for href:', href)
        content = await response.text()
      } else {
        throw new Error(`direct fetch failed for href: ${href}, status: ${response.status}`)
      }
    } catch (error) {
      console.error('error getting remote style sheet content for href:', href, 'error:', error)
      try {
        content = await backgroundFetch(href)
        console.log('background fetch successful for href:', href, content)
      } catch (error) {
        console.error('error dispatching background fetch:', error)
      }
    }
    pendingRemoteStyleSheets--
    return content
  }

  const applyContentToStyleSheet = async (styleSheet: CSSStyleSheet, css: string, mediaAttribute: string, baseURL: string, onloadCallback?: () => void): Promise<void> => {
    const content = maybeWrapWithMediaQuery(css, mediaAttribute)
    const { urls: importUrls, cssTextWithoutImports } = extractImportUrls(content)
    if (importUrls.length === 0) {
      styleSheet.replaceSync(cssTextWithoutImports)
      if (onloadCallback != null) {
        onloadCallback()
      }
    } else {
      const absoluteImportUrls = importUrls.map(url => new URL(url, baseURL).href)
      const remoteStyleSheetContents = await Promise.all(absoluteImportUrls.map(getRemoteStyleSheetContent))
      const fullContent = remoteStyleSheetContents.join('\n') + cssTextWithoutImports
      void applyContentToStyleSheet(styleSheet, fullContent, mediaAttribute, baseURL, onloadCallback)
    }
  }

  const styleSheetsForCssElements: Map<CSSElement, CSSStyleSheet> = new Map()

  const URLSafe = self.URL
  const URLhrefSafe = createSafeGetter(URL, 'href')

  /**
   * Converts relative CSS URLs to absolute ones.
   * @param {string} cssText - The raw CSS content.
   * @param {string} baseURL - The absolute URL of the original CSS file.
   */
  const convertToAbsoluteUrls = (cssText: string, baseURL: string): string => {
    // Regex captures the path inside url(), handling optional quotes and whitespace
    const urlRegex = /url\(\s*['"]?([^'")]*?)['"]?\s*\)/gi;
    return stringReplaceSafe(cssText, urlRegex, (match: string, path: string) => {
      // 1. Skip empty paths, absolute URLs, or data URIs
      if (!path || /^https?:\/\/|^data:|^blob:/i.test(path)) {
        return match;
      }
      // 2. Resolve the path relative to the baseURL
      try {
        const absoluteUrl = URLhrefSafe(new URLSafe(path, baseURL));
        return `url("${absoluteUrl}")`;
      } catch {
        // If resolution fails (invalid path), return the original match
        return match;
      }
    });
  }

  const applyRemoteContentToStyleSheet = (styleSheet: CSSStyleSheet, href: string, mediaAttribute: string, onloadCallback: () => void): void => {
    if (styleSheet == null) {
      // The style sheet was not valid or has been removed.
      return
    }
    // Initialize the style sheet with the remote content when it becomes available.
    void getRemoteStyleSheetContent(href).then(content => {
      if (content !== '' && content !== undefined) {
        const contentWithAbsoluteUrls = convertToAbsoluteUrls(content, href)
        void applyContentToStyleSheet(styleSheet, contentWithAbsoluteUrls, mediaAttribute, href, onloadCallback)
        document.documentElement.style.visibility = 'visible'
      }
    }).catch(error => {
      console.error('error applying remote content to style sheet for href:', href, 'error:', error)
    })
  }

  // Create a style sheet containing the CSS content of a link element.
  const createStyleSheetForLinkElement = (linkElement: HTMLLinkElement): CSSStyleSheet => {
    const styleSheet = new CSSStyleSheet()
    applyRemoteContentToStyleSheet(styleSheet, linkElement.href, linkElement.media,
                                   () => triggerOnLoadForLinkElement(linkElement))
    styleSheet.disabled = linkElement.disabled
    return styleSheet
  }

  // Create a style sheet containing the CSS content of a style element.
  const createStyleSheetForStyleElement = (styleElement: HTMLStyleElement): CSSStyleSheet => {
    const styleSheet = new CSSStyleSheet()
    console.log('createStyleSheetForStyleElement called in', self.location.href, self.top === self, styleElement.textContent)
    void applyContentToStyleSheet(styleSheet, styleElement.textContent ?? '', styleElement.media, self.location.href)
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
    void applyContentToStyleSheet(styleSheet, text, svgStyleElement.media, self.location.href)
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
    if ((frameCount === 3 && pendingRemoteStyleSheets === 0) ||
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
          void applyContentToStyleSheet(styleSheet, el.parentElement.textContent ?? '', el.parentElement.media, self.location.href)
        }
      } else if (el instanceof HTMLStyleElement &&
                 record.type === 'attributes' &&
                 record.attributeName === 'media' &&
                 record.oldValue !== el.media) {
        const styleSheet = getStyleSheetForCssElement(el)
        if (styleSheet !== undefined) {
          void applyContentToStyleSheet(styleSheet, el.textContent ?? '', el.media, self.location.href)
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
          applyRemoteContentToStyleSheet(styleSheet, el.href, el.media, () => triggerOnLoadForLinkElement(el))
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
        removedNodes.forEach(node => styleSheetsForCssElements.delete(node))
        const styleSheets = removedNodes.map(node => getStyleSheetForCssElement(node)).filter(sheet => sheet !== undefined)
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

  // Get the original replaceSync method before we patch it
  const replaceSyncSafe = createSafeMethod(CSSStyleSheet, 'replaceSync')
  const replaceSafe = createSafeMethod(CSSStyleSheet, 'replace')

  objectDefinePropertiesSafe(CSSStyleSheet.prototype, {
    replaceSync: {
      value (this: CSSStyleSheet, css: string) {
        replaceSyncSafe(this, css)
        sanitizeStyleSheet(this)
      }
    },
    replace: {
      async value (this: CSSStyleSheet, css: string) {
        await replaceSafe(this, css)
        sanitizeStyleSheet(this)
      }
    }
  })
}

export default css
