import { redefineFields, redefineMethods } from '@src/content_scripts/helpers/monkey-patch'
import { GlobalScope } from '../helpers/globalObject'

const screen = (globalObject: GlobalScope): void => {
  if (globalObject.Screen === undefined || globalObject.matchMedia === undefined) {
    return
  }
  const allowedScreenSizes: Array<[number, number]> = [
    [1920, 1080],
    [2560, 1440],
    [3840, 2160]
  ]
  const spoofScreenSize = (minWidth: number, minHeight: number): [number, number] => {
    for (const [width, height] of allowedScreenSizes) {
      if (width >= minWidth && height >= minHeight) {
        return [width, height]
      }
    }
    return allowedScreenSizes[allowedScreenSizes.length - 1]
  }
  const innerW = globalObject.innerWidth ?? 1920
  const innerH = globalObject.innerHeight ?? 1080
  const [spoofedScreenWidth, spoofedScreenHeight] = spoofScreenSize(innerW, innerH)
  redefineFields(globalObject.Screen.prototype, {
    availHeight: spoofedScreenHeight,
    availLeft: 0,
    availTop: 0,
    availWidth: spoofedScreenWidth,
    colorDepth: 24,
    height: spoofedScreenHeight,
    pixelDepth: 24,
    width: spoofedScreenWidth
  })
  redefineFields(globalObject, {
    devicePixelRatio: 2,
    outerHeight: globalObject.innerHeight ?? 1080,
    outerWidth: globalObject.innerWidth ?? 1920,
    screenLeft: 0,
    screenTop: 0,
    screenX: 0,
    screenY: 0
  })
  const oldMatchMedia = globalObject.matchMedia
  const mediaDeviceToViewport = (mediaQueryString: string): string => {
    return mediaQueryString
      ?.replaceAll('device-width', 'width')
      ?.replaceAll('device-height', 'height') ?? ''
  }
  // Match (color-gamut: srgb)
  const regex = /\(\s*color-gamut\s*:\s*([^)]+)\)/gi
  const spoofColorGamut = (mediaQueryString: string): string =>
    mediaQueryString.replace(regex, (_, value: string) =>
      value.trim().toLowerCase() === 'srgb' ? ' all ' : ' not all ')
  redefineMethods(globalObject, {
    matchMedia: (mediaQueryString: string): MediaQueryList => oldMatchMedia(mediaDeviceToViewport(spoofColorGamut(mediaQueryString)))
  })
}

export default screen
