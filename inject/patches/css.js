/* global CSSStyleSheet, HTMLStyleElement, Node, self */

import { redefinePropertiesSafe, reflectApplySafe } from '../helpers';

const css = () => {
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

  const addNewStyleElementsToAdoptedStyleSheets = () => {
    const styleElements = getLatestStyleElements();
    styleElements.forEach(styleElement => {
      const styleSheet = createStyleSheetForStyleElement(styleElement);
      document.adoptedStyleSheets.push(styleSheet);
    });
    self.requestAnimationFrame(addNewStyleElementsToAdoptedStyleSheets);
  };
  addNewStyleElementsToAdoptedStyleSheets();
};

export default css;
