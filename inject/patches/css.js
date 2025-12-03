/* global CSSStyleSheet, HTMLStyleElement, HTMLLinkElement, MutationObserver, SVGStyleElement, self */

import { redefinePropertiesSafe, reflectApplySafe } from '../helpers';

document.documentElement.style.visibility = 'hidden';

const css = () => {
  if (self.HTMLStyleElement === undefined) {
    return () => {};
  }

  /*
  const getAllRules = (styleSheet) => {
    const rulesFound = [];
    const getAllRulesInner = (rules) => {
      rules.forEach(rule => {
        rulesFound.push(rule);
        if (rule.cssRules) {
          getAllRulesInner(rule.cssRules);
        }
      });
    };
    getAllRulesInner(styleSheet.cssRules);
    return rulesFound;
  };
  */

  const getCssElements = () => {
    return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
  };

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

  const applyContentToStyleSheet = (styleSheet, css, mediaAttribute) => {
    const content = maybeWrapWithMediaQuery(css, mediaAttribute);
    styleSheet.replaceSync(content);
  };

  let pendingRemoteStyleSheets = 0;

  const getRemoteStyleSheetContent = async (href) => {
    /*
    const response = await chrome.runtime.sendMessage({ type: 'getRemoteStyleSheetContent', href });
    if (response.success) {
      return response.content;
    }
      */
    pendingRemoteStyleSheets++;
    console.log('fetching remote style sheet content for href:', href);
    const response = await fetch(href);
    if (response.ok) {
      return await response.text();
    }
    console.error('error getting remote style sheet content for href:', href, 'error:', response.error);
    pendingRemoteStyleSheets--;
    return undefined;
  };

  const styleSheetsForCssElements = new Map();

  const applyRemoteContentToStyleSheet = (styleSheet, href, mediaAttribute) => {
    // Initialize the style sheet with the remote content when it becomes available.
    getRemoteStyleSheetContent(href).then(content => {
      if (content) {
        // console.log('applying remote content to style sheet for href:', href, 'content.length:', content.length);
        applyContentToStyleSheet(styleSheet, content, mediaAttribute);
        document.documentElement.style.visibility = 'visible';
      }
    }).catch(error => {
      console.error('error applying remote content to style sheet for href:', href, 'error:', error);
    });
  };

  const elementsSeen = new WeakSet();

  // Create a style sheet containing the CSS content of a link element.
  const createStyleSheetForLinkElement = (linkElement) => {
    const styleSheet = new CSSStyleSheet();
    applyRemoteContentToStyleSheet(styleSheet, linkElement.href, linkElement.media);
    elementsSeen.add(linkElement);
    return styleSheet;
  };

  // Create a style sheet containing the CSS content of a style element.
  const createStyleSheetForStyleElement = (styleElement) => {
    const styleSheet = new CSSStyleSheet();
    applyContentToStyleSheet(styleSheet, styleElement.textContent, styleElement.media);
    styleSheet.disabled = styleElement.disabled;
    elementsSeen.add(styleElement);
    return styleSheet;
  };

  const originalMapGetter = Object.getOwnPropertyDescriptor(Map.prototype, 'get').value;
  const mapGetSafe = (map, key) => reflectApplySafe(originalMapGetter, map, [key]);

  // Get the style sheet for a style element, creating it if it doesn't exist.
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
      // TODO: Handle SVG style elements.
    } else {
      throw new Error(`unknown CSS element type: ${cssElement}`);
    }
    styleSheetsForCssElements.set(cssElement, styleSheet);
    return styleSheet;
  };

  let frameCount = 0;

  // Ensure there is a style sheet for each style and link element
  // in the document's adopted style sheets.
  // We don't use a MutationObserver for the addition of new style
  // elements because it would be too slow and cause a FOUC.
  const updateAdoptedStyleSheetsToMatchCssElements = () => {
    const cssElements = getCssElements();
    if (cssElements.some(element => !elementsSeen.has(element))) {
      const currentStyleSheets = cssElements.map(getStyleSheetForCssElement).filter(sheet => sheet !== undefined);
      const adopted = document.adoptedStyleSheets;
      if (currentStyleSheets.length !== adopted.length ||
          currentStyleSheets.some((sheet, index) => sheet !== adopted[index])) {
        document.adoptedStyleSheets = currentStyleSheets;
      }
      if ((frameCount === 3 && pendingRemoteStyleSheets === 0) ||
           frameCount === 10) {
        document.documentElement.style.visibility = 'visible';
      }
    }
    frameCount++;
    self.requestAnimationFrame(updateAdoptedStyleSheetsToMatchCssElements); // document.documentElement.style.visibility = 'visible';
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
      }
    }
  });
  mutationObserver.observe(document.documentElement, {
    childList: false,
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
      get: function () {
        return getStyleSheetForCssElement(this);
      }
    }
  });

  // HTMLLinkElement.sheet should return the adopted style
  // sheet we have created for the link element.
  redefinePropertiesSafe(HTMLLinkElement.prototype, {
    sheet: {
      get: function () {
        return getStyleSheetForCssElement(this);
      }
    }
  });
};

export default css;
