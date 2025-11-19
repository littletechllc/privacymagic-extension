import { getDisabledSettings } from './helpers.js';

import battery from './patches/battery.js';
import cpu from './patches/cpu.js';
import device from './patches/device.js';
import gpc from './patches/gpc.js';
import gpu from './patches/gpu.js';
import iframe from './patches/iframe.js';
import keyboard from './patches/keyboard.js';
import memory from './patches/memory.js';
import screen from './patches/screen.js';
import serviceWorker from './patches/serviceWorker.js';
import sharedStorage from './patches/sharedStorage.js';
import timer from './patches/timer.js';
import useragent from './patches/useragent.js';
import windowName from './patches/windowName.js';
import worker from './patches/worker.js';

const privacyMagicPatches = {
  battery,
  cpu,
  device,
  gpc,
  gpu,
  iframe,
  keyboard,
  memory,
  screen,
  serviceWorker,
  sharedStorage,
  timer,
  useragent,
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
  const relevantSettings = Object.keys(privacyMagicPatches);
  runPatchesInPageExcept(getDisabledSettings(relevantSettings));
};
mainFunction();
console.log('foreground.js loaded', Date.now());
