import { getDisabledSettings } from '@src/content_scripts/helpers/helpers'
import { type GlobalScope } from '@src/content_scripts/helpers/globalObject'
import { ContentSettingId } from '@src/common/setting-ids'

import audio from '@src/content_scripts/patches/audio'
import battery from '@src/content_scripts/patches/battery'
import cpu from '@src/content_scripts/patches/cpu'
import device from '@src/content_scripts/patches/device'
import disk from '@src/content_scripts/patches/disk'
import display from '@src/content_scripts/patches/display'
import fonts from '@src/content_scripts/patches/fonts'
import gpc from '@src/content_scripts/patches/gpc'
import gpu from '@src/content_scripts/patches/gpu'
import iframe from '@src/content_scripts/patches/iframe'
import keyboard from '@src/content_scripts/patches/keyboard'
import language from '@src/content_scripts/patches/language'
import math from '@src/content_scripts/patches/math'
import memory from '@src/content_scripts/patches/memory'
import network from '@src/content_scripts/patches/network'
import screen from '@src/content_scripts/patches/screen'
import serviceWorker from '@src/content_scripts/patches/serviceWorker'
import sharedStorage from '@src/content_scripts/patches/sharedStorage'
import timer from '@src/content_scripts/patches/timer'
import timezone from '@src/content_scripts/patches/timezone'
import touch from '@src/content_scripts/patches/touch'
import useragent from '@src/content_scripts/patches/useragent'
import windowName from '@src/content_scripts/patches/windowName'
import worker from '@src/content_scripts/patches/worker'
import sanitizeGetHighEntropyValues from '../patches/patch_helpers/highEntropy'

type PatchFn<T extends (arg: GlobalScope) => void> =
  Parameters<T> extends [GlobalScope]
    ? T
    : never

const privacyMagicPatches: Record<Exclude<ContentSettingId, 'masterSwitch'>, PatchFn<(globalObject: GlobalScope) => void>> = {
  audio,
  battery,
  cpu,
  //css,
  device,
  display,
  disk,
  fonts,
  gpc,
  gpu,
  iframe,
  keyboard,
  language,
  math,
  memory,
  network,
  screen,
  serviceWorker,
  sharedStorage,
  timer,
  timezone,
  touch,
  useragent,
  windowName,
  worker
}

export const applyPatchesToGlobalObject = (globalObject: GlobalScope): void => {
  const disabledPatches = getDisabledSettings()
  if (disabledPatches.includes('masterSwitch')) {
    return
  }
  for (const patcherId of Object.keys(privacyMagicPatches) as (keyof typeof privacyMagicPatches)[]) {
    try {
      if (!disabledPatches.includes(patcherId)) {
        const patch = privacyMagicPatches[patcherId]
        if (patch != null) {
          patch(globalObject)
        }
      }
    } catch (error) {
      console.error('error running patch', patcherId, error)
    }
  }
  sanitizeGetHighEntropyValues(globalObject, disabledPatches as Exclude<ContentSettingId, 'masterSwitch'>[])
}
