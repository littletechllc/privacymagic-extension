import { getDisabledSettings } from './helpers/helpers'
import { ContentSettingId } from '@src/common/setting-ids'

import audio from './patches/audio'
import battery from './patches/battery'
import cpu from './patches/cpu'
import css from './patches/css'
import device from './patches/device'
import disk from './patches/disk'
import display from './patches/display'
import fonts from './patches/fonts'
import gpc from './patches/gpc'
import gpu from './patches/gpu'
import iframe from './patches/iframe'
import keyboard from './patches/keyboard'
import language from './patches/language'
import math from './patches/math'
import memory from './patches/memory'
import screen from './patches/screen'
import serviceWorker from './patches/serviceWorker'
import sharedStorage from './patches/sharedStorage'
import timer from './patches/timer'
import timezone from './patches/timezone'
import touch from './patches/touch'
import useragent from './patches/useragent'
import windowName from './patches/windowName'
import worker from './patches/worker'


const privacyMagicPatches: Record<Exclude<ContentSettingId, 'masterSwitch'>, () => void> = {
  audio,
  battery,
  cpu,
  css,
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

const runPatchesInPageExcept = (disabledPatches: ContentSettingId[]): void => {
  if (disabledPatches.includes('masterSwitch')) {
    return
  }
  for (const patcherId of Object.keys(privacyMagicPatches) as Exclude<ContentSettingId, 'masterSwitch'>[]) {
    try {
      if (!disabledPatches.includes(patcherId)) {
        const patch = privacyMagicPatches[patcherId]
        if (patch != null) {
          patch()
        }
      }
    } catch (error) {
      console.error('error running patch', patcherId, error)
    }
  }
}

const mainFunction = (): void => {
  console.log('main function called in', self.location.href)
  const relevantSettings = ['masterSwitch', ...Object.keys(privacyMagicPatches)] as ContentSettingId[]
  runPatchesInPageExcept(getDisabledSettings(relevantSettings))
}
mainFunction()
