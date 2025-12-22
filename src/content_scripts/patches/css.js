/* global CSSGroupingRule, CSSMediaRule, CSSStyleSheet, Document, Element, HTMLStyleElement, HTMLLinkElement, MutationObserver, ShadowRoot, SVGStyleElement, self */

import { redefinePropertiesSafe, reflectApplySafe } from '../helpers';

/** @typedef { HTMLStyleElement | HTMLLinkElement | SVGStyleElement } CSSElement */

const css = () => {
  console.log('css patch');
  if (self.HTMLStyleElement === undefined) {
    // We are likely in a worker context.
    return () => {};
  }

  document.documentElement.style.visibility = 'hidden';
  const noTransitionsStyleElement = document.createElement('style');
  noTransitionsStyleElement.textContent = `
    * {
      transition: none !important;
    }
  `;
  document.documentElement.appendChild(noTransitionsStyleElement);

  const originalAttachShadow = Object.getOwnPropertyDescriptor(Element.prototype, 'attachShadow').value;
  /** @type { (element: Element, init: ShadowRootInit) => ShadowRoot } */
  const originalAttachShadowSafe = (element, init) => reflectApplySafe(originalAttachShadow, element, [init]);
  /** @type { Set<Document | ShadowRoot> } */
  const shadowRoots = new Set([document]);
  redefinePropertiesSafe(Element.prototype, {
    attachShadow: {
      /** @this {Element} @param {ShadowRootInit} init */
      value: function (init) {
        const shadowRoot = originalAttachShadowSafe(this, init);
        shadowRoots.add(shadowRoot);
        return shadowRoot;
      }
    }
  });

  /** @type { (cssText: string) => { urls: string[], cssTextWithoutImports: string } } */
  const extractImportUrls = (cssText) => {
    /** @type { string[] } */
    const urls = [];
    const regex = /@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*;/gi;
    let match;
    while ((match = regex.exec(cssText)) !== null) {
      urls.push(match[1]);
    }
    const cssTextWithoutImports = cssText.replace(regex, '');
    return { urls, cssTextWithoutImports };
  };

  /** @type { (css: string, mediaAttribute: string) => string } */
  const maybeWrapWithMediaQuery = (css, mediaAttribute) => {
    if (css === undefined ||
      css === null ||
      css === '') {
      return '';
    }
    if (mediaAttribute === undefined ||
      mediaAttribute === null ||
      mediaAttribute === '') {
      return css;
    }
    return `@media ${mediaAttribute} { ${css} }`;
  };

  let pendingRemoteStyleSheets = 0;

  /** @type { (href: string) => Promise<string> } */
  const getRemoteStyleSheetContent = async (href) => {
    /*
    const response = await chrome.runtime.sendMessage({ type: 'getRemoteStyleSheetContent', href });
    if (response.success) {
      return response.content;
    }
      */
    pendingRemoteStyleSheets++;
    try {
      const response = await fetch(href);
      if (response.ok) {
        return await response.text();
      } else {
        // TODO: Handle CORS case. We may need to fetch the content from the background script.
        throw new Error(`failed to fetch remote style sheet content for href: ${href}, status: ${response.status}`);
      }
    } catch (error) {
      console.error('error getting remote style sheet content for href:', href, 'error:', error);
      pendingRemoteStyleSheets--;
      return '';
    }
  };

  /** @type { (styleSheet: CSSStyleSheet, css: string, mediaAttribute: string) => Promise<void> } */
  const applyContentToStyleSheet = async (styleSheet, css, mediaAttribute) => {
    const content = maybeWrapWithMediaQuery(css, mediaAttribute);
    const { urls: importUrls, cssTextWithoutImports } = extractImportUrls(content);
    if (importUrls.length === 0) {
      styleSheet.replaceSync(cssTextWithoutImports);
    } else {
      const remoteStyleSheetContents = await Promise.all(importUrls.map(getRemoteStyleSheetContent));
      const fullContent = remoteStyleSheetContents.join('\n') + cssTextWithoutImports;
      applyContentToStyleSheet(styleSheet, fullContent, mediaAttribute);
    }
  };

  /** @type { Map<CSSElement, CSSStyleSheet> } */
  const styleSheetsForCssElements = new Map();

  /** @type { (styleSheet: CSSStyleSheet, href: string, mediaAttribute: string) => void } */
  const applyRemoteContentToStyleSheet = (styleSheet, href, mediaAttribute) => {
    // Initialize the style sheet with the remote content when it becomes available.
    getRemoteStyleSheetContent(href).then(content => {
      if (content) {
        applyContentToStyleSheet(styleSheet, content, mediaAttribute);
        document.documentElement.style.visibility = 'visible';
      }
    }).catch(error => {
      console.error('error applying remote content to style sheet for href:', href, 'error:', error);
    });
  };

  /** Create a style sheet containing the CSS content of a link element.
   * @type { (linkElement: HTMLLinkElement) => CSSStyleSheet } */
  const createStyleSheetForLinkElement = (linkElement) => {
    const styleSheet = new CSSStyleSheet();
    applyRemoteContentToStyleSheet(styleSheet, linkElement.href, linkElement.media);
    styleSheet.disabled = linkElement.disabled;
    return styleSheet;
  };

  /** Create a style sheet containing the CSS content of a style element.
   * @type { (styleElement: HTMLStyleElement) => CSSStyleSheet } */
  const createStyleSheetForStyleElement = (styleElement) => {
    const styleSheet = new CSSStyleSheet();
    applyContentToStyleSheet(styleSheet, styleElement.textContent, styleElement.media);
    styleSheet.disabled = styleElement.disabled;
    return styleSheet;
  };

  /** Create a style sheet containing the CSS content of a SVG style element.
   * The style sheet has a root CSS selector scoping the CSS content to the
   * SVG element.
   * @type { (svgStyleElement: SVGStyleElement) => CSSStyleSheet } */
  const createStyleSheetForSvgStyleElement = (svgStyleElement) => {
    const styleSheet = new CSSStyleSheet();
    const svg = svgStyleElement.closest('svg');
    if (svg === null) {
      throw new Error('svg style element does not have an ancestor svg element');
    }
    const svgId = crypto.randomUUID();
    svg.setAttribute('data-svg-id', svgId);
    const text = `[data-svg-id="${svgId}"] { ${svgStyleElement.textContent} }`;
    applyContentToStyleSheet(styleSheet, text, svgStyleElement.media);
    styleSheet.disabled = svgStyleElement.disabled;
    return styleSheet;
  };

  /** @type { (map: Map<any, any>, key: any) => any } */
  const originalMapGetter = Object.getOwnPropertyDescriptor(Map.prototype, 'get').value;
  /** @type { (map: Map<any, any>, key: any) => any } */
  const mapGetSafe = (map, key) => reflectApplySafe(originalMapGetter, map, [key]);

  /** @type { (cssElement: CSSElement) => Document | ShadowRoot } */
  const getRootNode = (cssElement) => {
    if (cssElement === undefined ||
        cssElement === null) {
      return undefined;
    }
    const root = cssElement.getRootNode();
    if (root === cssElement) {
      return undefined;
    }
    if (root instanceof Document || root instanceof ShadowRoot) {
      return root;
    }
    throw new Error(`unknown root node type: ${root}`);
  };

  /** Get the style sheet for a style element, creating it if it doesn't exist.
   * @type { (cssElement: CSSElement) => CSSStyleSheet } */
  const getStyleSheetForCssElement = (cssElement) => {
    const sheet = mapGetSafe(styleSheetsForCssElements, cssElement);
    if (sheet) {
      return sheet;
    }
    let styleSheet;
    if (cssElement instanceof HTMLLinkElement) {
      styleSheet = createStyleSheetForLinkElement(cssElement);
    } else if (cssElement instanceof HTMLStyleElement) {
      styleSheet = createStyleSheetForStyleElement(cssElement);
    } else if (cssElement instanceof SVGStyleElement) {
      styleSheet = createStyleSheetForSvgStyleElement(cssElement);
    } else {
      throw new Error(`unknown CSS element type: ${cssElement}`);
    }
    styleSheetsForCssElements.set(cssElement, styleSheet);
    const root = getRootNode(cssElement);
    if (root === undefined) {
      return undefined;
    }
    // TODO: Make sure the style element is inserted in the correct position in the adopted style sheets.
    root.adoptedStyleSheets.push(styleSheet);
    return styleSheet;
  };

  let frameCount = 0;

  /** @type { (root: Document | ShadowRoot) => void } */
  const updateStyleSheetsForRoot = (root) => {
    /** @type { CSSElement[] } */
    const cssElements = Array.from(root.querySelectorAll('style, link[rel="stylesheet"]'));
    if (cssElements.some(element => !styleSheetsForCssElements.has(element))) {
      const currentStyleSheets = cssElements.map(getStyleSheetForCssElement).filter(sheet => sheet !== undefined);
      const adopted = root.adoptedStyleSheets;
      if (currentStyleSheets.length !== adopted.length ||
          currentStyleSheets.some((sheet, index) => sheet !== adopted[index])) {
        root.adoptedStyleSheets = currentStyleSheets;
      }
    }
  };

  /** Ensure there is a style sheet for each style and link element
   * in the document's adopted style sheets.
   * We don't use a MutationObserver for the addition of new style
   * elements because it would be too slow and cause a FOUC.
   * @type { () => void } */
  const updateAdoptedStyleSheetsToMatchCssElements = () => {
    shadowRoots.forEach(updateStyleSheetsForRoot);
    if ((frameCount === 3 && pendingRemoteStyleSheets === 0) ||
      frameCount === 10) {
      document.documentElement.style.visibility = 'visible';
      noTransitionsStyleElement.remove();
    }
    frameCount++;
    self.requestAnimationFrame(updateAdoptedStyleSheetsToMatchCssElements);
  };
  updateAdoptedStyleSheetsToMatchCssElements();

  // Use a MutationObserver to watch for changes to the CSS content or
  // media attribute of existing style elements. Whenever a change is
  // observed, update the corresponding adopted style sheet to match
  // the new CSS content or media attribute.
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      const el = record.target;
      if (record.type === 'characterData' &&
        el.parentElement instanceof HTMLStyleElement &&
        record.oldValue !== el.parentElement.textContent) {
        const styleSheet = getStyleSheetForCssElement(el.parentElement);
        applyContentToStyleSheet(styleSheet, el.parentElement.textContent, el.parentElement.media);
      } else if (el instanceof HTMLStyleElement &&
                 record.type === 'attributes' &&
                 record.attributeName === 'media' &&
                 record.oldValue !== el.media) {
        const styleSheet = getStyleSheetForCssElement(el);
        applyContentToStyleSheet(styleSheet, el.textContent, el.media);
      } else if (el instanceof HTMLLinkElement &&
                 record.type === 'attributes' &&
                 ((record.attributeName === 'href' &&
                 record.oldValue !== el.href) ||
                 (record.attributeName === 'media' &&
                  record.oldValue !== el.media))) {
        const styleSheet = getStyleSheetForCssElement(el);
        applyRemoteContentToStyleSheet(styleSheet, el.href, el.media);
      } else if ((el instanceof HTMLLinkElement || el instanceof HTMLStyleElement) &&
                  record.type === 'attributes' &&
                  record.attributeName === 'disabled') {
        const styleSheet = getStyleSheetForCssElement(el);
        if (styleSheet.disabled !== el.disabled) {
          styleSheet.disabled = el.disabled;
        }
      } else if (record.type === 'childList' && record.removedNodes.length > 0) {
        const removedNodes = Array.from(record.removedNodes)
          .filter(node => node instanceof HTMLStyleElement || node instanceof HTMLLinkElement);
        removedNodes.forEach(node => styleSheetsForCssElements.delete(node));
        const styleSheets = removedNodes.map(node => getStyleSheetForCssElement(node)).filter(sheet => sheet !== undefined);
        const root = getRootNode(removedNodes[0]);
        if (root !== undefined) {
          root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => !styleSheets.includes(sheet));
        }
      }
    }
  });
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'media', 'href'],
    characterData: true,
    attributeOldValue: true,
    characterDataOldValue: true
  });

  // HTMLStyleElement.sheet should return the adopted style
  // sheet we have created for the style element.
  redefinePropertiesSafe(HTMLStyleElement.prototype, {
    sheet: {
      /** @this {HTMLStyleElement} */
      get: function () {
        return getStyleSheetForCssElement(this);
      }
    }
  });

  // HTMLLinkElement.sheet should return the adopted style
  // sheet we have created for the link element.
  redefinePropertiesSafe(HTMLLinkElement.prototype, {
    sheet: {
      /** @this {HTMLLinkElement} */
      get: function () {
        return getStyleSheetForCssElement(this);
      }
    }
  });

  /** @type { (styleSheet: CSSStyleSheet, css: string) => void } */
  const originalReplaceSync = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'replaceSync').value;
  /** @type { (styleSheet: CSSStyleSheet, css: string) => void } */
  const originalReplaceSyncSafe = (styleSheet, css) => reflectApplySafe(originalReplaceSync, styleSheet, [css]);

  /** @type { (rule: CSSRule) => CSSRule } */
  const sanitizeRule = (rule) => {
    if (rule instanceof CSSMediaRule) {
      rule.media.mediaText = rule.media.mediaText.replace(/device-width/g, 'width').replace(/device-height/g, 'height');
    }
    if (rule instanceof CSSGroupingRule) {
      for (const childRule of Array.from(rule.cssRules)) {
        sanitizeRule(childRule);
      }
    }
    return rule;
  };

  /** @type { (css: string) => string } */
  const sanitizeCss = (css) => {
    const tempStyleSheet = new CSSStyleSheet();
    originalReplaceSyncSafe(tempStyleSheet, css);
    const rules = Array.from(tempStyleSheet.cssRules);
    return rules.map(sanitizeRule).map(rule => rule.cssText).join('\n');
  };

  redefinePropertiesSafe(CSSStyleSheet.prototype, {
    replaceSync: {
      /** @this {CSSStyleSheet} @param {string} css */
      value: function (css) {
        originalReplaceSyncSafe(this, sanitizeCss(css));
      }
    }
  });
};

export default css;
