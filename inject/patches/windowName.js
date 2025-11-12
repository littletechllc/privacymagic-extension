/* global window */

import { definePropertiesSafe } from '../helpers.js';

const windowName = () => {
  if (window.top !== window) {
    return;
  }
  const propDescriptor = Object.getOwnPropertyDescriptor(window, 'name');
  if (!propDescriptor) {
    return;
  }
  const nameGetter = propDescriptor.get;
  const nameSetter = propDescriptor.set;
  Object.defineProperty(window, 'name', {
    get () {
      const nameStr = nameGetter.call(this);
      try {
        const data = JSON.parse(nameStr);
        if (typeof data !== 'object' || data === null) {
          return '';
        }
        const origin = window.location.origin;
        if (typeof data[origin] !== 'string') {
          return '';
        }
        return data[origin];
      } catch (error) {
        return '';
      }
    },
    set (value) {
      const nameStr = nameGetter.call(this);
      let data;
      try {
        data = JSON.parse(nameStr);
        if (typeof data !== 'object' || data === null) {
          data = {};
        }
      } catch (error) {
        data = {};
      }
      const origin = window.location.origin;
      if (!origin || origin.length === 0) {
        return;
      }
      // String(value) matches window.name native behavior
      data[origin] = String(value);
      nameSetter.call(this, JSON.stringify(data));
    },
    configurable: true
  });
  console.log('window.name patched');
  return () => {
    definePropertiesSafe(window, { name: propDescriptor });
  };
};

export default windowName;
