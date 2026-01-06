import { redefinePropertyValues } from '../helpers'

const screen = () => {
  if (!self.Screen) {
    return () => {}
  }
  const oldMatchMedia = self.matchMedia
  const mediaDeviceToViewport = (mediaQueryString: string): string => mediaQueryString
    ?.replaceAll('device-width', 'width')
    ?.replaceAll('device-height', 'height')
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
  const [spoofedScreenWidth, spoofedScreenHeight] = spoofScreenSize(innerWidth, innerHeight)
  const restoreScreen = redefinePropertyValues(Screen.prototype, {
    availHeight: spoofedScreenHeight,
    availLeft: 0,
    availTop: 0,
    availWidth: spoofedScreenWidth,
    colorDepth: 24,
    height: spoofedScreenHeight,
    pixelDepth: 24,
    width: spoofedScreenWidth
  })
  const restoreWindow = redefinePropertyValues(self, {
    devicePixelRatio: 2,
    matchMedia: (mediaQueryString: string): MediaQueryList => oldMatchMedia(mediaDeviceToViewport(mediaQueryString)),
    outerHeight: self.innerHeight,
    outerWidth: self.innerWidth,
    screenLeft: 0,
    screenTop: 0,
    screenX: 0,
    screenY: 0
  })
  // Match (color-gamut: srgb)
  const regex = /\(\s*color-gamut\s*:\s*([^)]+)\)/gi
  const matchMediaClean = (mediaQueryString: string): string =>
    mediaQueryString.replace(regex, (_, value: string) =>
      value.trim().toLowerCase() === 'srgb' ? ' all ' : ' not all ')
  const restoreMatchMedia = redefinePropertyValues(self, {
    matchMedia: (mediaQueryString: string): MediaQueryList => oldMatchMedia(matchMediaClean(mediaQueryString))
  })
  return () => {
    restoreScreen()
    restoreWindow()
    restoreMatchMedia()
  }
}

export default screen
