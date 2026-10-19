/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  const allowed = [[1920, 1080], [2560, 1440], [3840, 2160]]
  let expectedWidth = allowed[allowed.length - 1][0]
  let expectedHeight = allowed[allowed.length - 1][1]
  for (const [width, height] of allowed) {
    if (width >= innerWidth && height >= innerHeight) {
      expectedWidth = width
      expectedHeight = height
      break
    }
  }
  const srgb = matchMedia('(color-gamut: srgb)')
  const p3 = matchMedia('(color-gamut: p3)')
  return {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    availLeft: screen.availLeft,
    availTop: screen.availTop,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    devicePixelRatio,
    screenX,
    screenY,
    screenLeft,
    screenTop,
    outerMatchesInner: outerWidth === innerWidth && outerHeight === innerHeight,
    sizeMatchesViewport: screen.width === expectedWidth && screen.height === expectedHeight,
    srgb: { matches: srgb.matches, media: srgb.media },
    p3: { matches: p3.matches, media: p3.media }
  }
}
