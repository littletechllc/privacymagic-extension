/* global CSSStyleSheet, HTMLStyleElement, MutationObserver, Node, self */

import { redefinePropertiesSafe } from '../helpers';

const css = () => {
  // TODO: Find a way to getStyleSheetForStyleElement that
  // communicates with the isolated content script.
  /*
  // HTMLStyleElement.sheet should return the adopted style
  // sheet we have created for the style element.
  redefinePropertiesSafe(HTMLStyleElement.prototype, {
    sheet: {
      get: function () {
        return getStyleSheetForStyleElement(this);
      }
    }
  });
  */
};

export default css;
