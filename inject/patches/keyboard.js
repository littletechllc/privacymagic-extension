/* global Navigator */

import { redefinePropertyValues } from '../helpers.js';

const keyboard = () => {
  return redefinePropertyValues(Navigator.prototype, {
    keyboard: undefined
  });
};

export default keyboard;
