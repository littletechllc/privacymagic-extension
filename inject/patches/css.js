/* global CSSStyleSheet, HTMLStyleElement, MutationObserver, Node, self */

import { redefinePropertiesSafe, reflectApplySafe } from '../helpers';

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

  const getStyleElements = () => {
    return Array.from(document.getElementsByTagName('style'));
  };

  const maybeWrapWithMediaQuery = (css, mediaAttribute) => {
    if (mediaAttribute === undefined ||
      mediaAttribute === null ||
      mediaAttribute === '') {
      return css;
    }
    return `@media ${mediaAttribute} { ${css} }`;
  };

  const originalMapGetter = Object.getOwnPropertyDescriptor(Map.prototype, 'get').value;
  const mapGetSafe = (map, key) => reflectApplySafe(originalMapGetter, map, [key]);

  const styleSheetsForStyleElements = new Map();

  // Create a style sheet containing the CSS content of a style element.
  const createStyleSheetForStyleElement = (styleElement) => {
    const content = maybeWrapWithMediaQuery(styleElement.textContent, styleElement.media);
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(content);
    styleSheetsForStyleElements.set(styleElement, styleSheet);
    return styleSheet;
  };

  // Get the style sheet for a style element, creating it if it doesn't exist.
  const getStyleSheetForStyleElement = (styleElement) => {
    const sheet = mapGetSafe(styleSheetsForStyleElements, styleElement);
    if (sheet) {
      return sheet;
    }
    return createStyleSheetForStyleElement(styleElement);
  };

  // Ensure there is a style sheet for each non-disabled style element
  // in the document's adopted style sheets.
  // We don't use a MutationObserver for the addition of new style
  // elements because it would be too slow and cause a FOUC.
  const updateAdoptedStyleSheetsToMatchStyleElements = () => {
    const styleElements = getStyleElements();
    const activeStyleElements = styleElements.filter(styleElement => !styleElement.disabled);
    document.adoptedStyleSheets = activeStyleElements.map(getStyleSheetForStyleElement);
    self.requestAnimationFrame(updateAdoptedStyleSheetsToMatchStyleElements);
  };
  updateAdoptedStyleSheetsToMatchStyleElements();

  // Use a MutationObserver to watch for changes to the CSS content or
  // media attribute of existing style elements. Whenever a change is
  // observed, update the corresponding adopted style sheet to match
  // the new CSS content or media attribute.
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      const el = record.target;
      if (el instanceof HTMLStyleElement &&
        (record.type === 'characterData' ||
          (record.type === 'attributes' && record.attributeName === 'media'))) {
        const styleSheet = getStyleSheetForStyleElement(el);
        const content = maybeWrapWithMediaQuery(el.textContent, el.media);
        styleSheet.replaceSync(content);
      }
    }
  });
  mutationObserver.observe(document.documentElement, {
    childList: false,
    subtree: false,
    attributes: true,
    attributeFilter: ['disabled', 'media'],
    characterData: true
  });

  // HTMLStyleElement.sheet should return the adopted style
  // sheet we have created for the style element.
  redefinePropertiesSafe(HTMLStyleElement.prototype, {
    sheet: {
      get: function () {
        return getStyleSheetForStyleElement(this);
      }
    }
  });
};

export default css;
