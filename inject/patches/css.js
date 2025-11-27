/* global CSSStyleSheet, HTMLStyleElement, MutationObserver, Node, self */

import { redefinePropertiesSafe, reflectApplySafe } from '../helpers';

const css = () => {
  // Remove an item from an array if it is present.
  const removeIfPresent = (array, item) => {
    const index = array.indexOf(item);
    if (index !== -1) {
      array.splice(index, 1);
    }
  };

  if (self.HTMLStyleElement === undefined) {
    return () => {};
  }
  const alreadySeenStyleElements = new Set();

  const getLatestStyleElements = () => {
    const styleElements = Array.from(document.getElementsByTagName('style'));
    const latestStyleElements = styleElements.filter(styleElement => !alreadySeenStyleElements.has(styleElement));
    latestStyleElements.forEach(styleElement => alreadySeenStyleElements.add(styleElement));
    return latestStyleElements;
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

  const createStyleSheetForStyleElement = (styleElement) => {
    const content = maybeWrapWithMediaQuery(styleElement.textContent, styleElement.media);
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(content);
    styleSheetsForStyleElements.set(styleElement, styleSheet);
    return styleSheet;
  };

  const getStyleSheetForStyleElement = (styleElement) => {
    const sheet = mapGetSafe(styleSheetsForStyleElements, styleElement);
    if (sheet) {
      return sheet;
    }
    return createStyleSheetForStyleElement(styleElement);
  };

  redefinePropertiesSafe(HTMLStyleElement.prototype, {
    sheet: {
      get: function () {
        return getStyleSheetForStyleElement(this);
      }
    }
  });

  const originalNodeTextContentGetter = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').get;
  const nodeTextContentGetterSafe = (node) => reflectApplySafe(originalNodeTextContentGetter, node, []);

  const originalNodeTextContentSetter = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').set;
  const nodeTextContentSetterSafe = (node, value) => reflectApplySafe(originalNodeTextContentSetter, node, [value]);

  redefinePropertiesSafe(Node.prototype, {
    textContent: {
      get: function () {
        return nodeTextContentGetterSafe(this);
      },
      set: function (value) {
        if (this instanceof HTMLStyleElement) {
          const sheet = getStyleSheetForStyleElement(this);
          sheet.replaceSync(value);
        }
        return nodeTextContentSetterSafe(this, value);
      }
    }
  });

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

  // Watch for new style elements, create a style sheet for
  // the CSS content, and add it to the document's adopted style sheets.
  // We don't use a MutationObserver for the addition of new style
  // elements because it would be too slow and cause a FOUC.
  const addNewStyleElementsToAdoptedStyleSheets = () => {
    const styleElements = getLatestStyleElements();
    styleElements.forEach(styleElement => {
      const styleSheet = getStyleSheetForStyleElement(styleElement);
      if (!styleSheet.disabled) {
        if (!document.adoptedStyleSheets.includes(styleSheet)) {
          document.adoptedStyleSheets.push(styleSheet);
        }
      }
    });
    self.requestAnimationFrame(addNewStyleElementsToAdoptedStyleSheets);
  };
  addNewStyleElementsToAdoptedStyleSheets();

  // Use a MutationObserver to watch for changes to existing style elements,
  // including removal, attribute changes, and textContent (CSS content) changes.
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      const el = record.target;
      if (el instanceof HTMLStyleElement && record.type === 'attributes') {
        if (record.attributeName === 'disabled') {
          const styleSheet = getStyleSheetForStyleElement(el);
          if (styleSheet.disabled) {
            removeIfPresent(document.adoptedStyleSheets, styleSheet);
          } else {
            if (!document.adoptedStyleSheets.includes(styleSheet)) {
              document.adoptedStyleSheets.push(styleSheet);
            }
          }
        }
      } else if (record.type === 'characterData') {
        const el = record.target;
        if (el.parentNode instanceof HTMLStyleElement) {
          const style = el.parentNode;
          const styleSheet = getStyleSheetForStyleElement(style);
          styleSheet.replaceSync(style.textContent);
        }
      } else if (record.removedNodes.length > 0) {
        for (const removedNode of Array.from(record.removedNodes)) {
          if (removedNode instanceof HTMLStyleElement) {
            if (!document.contains(removedNode)) {
              const styleSheet = getStyleSheetForStyleElement(removedNode);
              removeIfPresent(document.adoptedStyleSheets, styleSheet);
            }
          }
        }
      }
    }
  });
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled'],
    characterData: true
  });
};

export default css;
