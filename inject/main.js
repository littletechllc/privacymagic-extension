import { getDisabledSettings } from './helpers.js';

import battery from './patches/battery.js';
import gpc from './patches/gpc.js';
import gpu from './patches/gpu.js';
import hardware from './patches/hardware.js';
import iframe from './patches/iframe.js';
import keyboard from './patches/keyboard.js';
import screen from './patches/screen.js';
import serviceWorker from './patches/serviceWorker.js';
import sharedStorage from './patches/sharedStorage.js';
import timer from './patches/timer.js';
import useragent from './patches/useragent.js';
import windowName from './patches/windowName.js';
import worker from './patches/worker.js';

const privacyMagicPatches = {
  battery,
  gpc,
  gpu,
  hardware,
  iframe,
  keyboard,
  screen,
  timer,
  useragent,
  serviceWorker,
  sharedStorage,
  windowName,
  worker
};

const runPatchesInPageExcept = (disabledPatches) => {
  const undoFunctions = Object.create(null);
  for (const patcherId of Object.keys(privacyMagicPatches)) {
    try {
      if (!disabledPatches.includes(patcherId)) {
        undoFunctions[patcherId] = privacyMagicPatches[patcherId]();
      }
    } catch (error) {
      console.error('error running patch', patcherId, error);
    }
  }
};

const mainFunction = () => {
  runPatchesInPageExcept(getDisabledSettings());
};
mainFunction();
console.log('foreground.js loaded', Date.now());
