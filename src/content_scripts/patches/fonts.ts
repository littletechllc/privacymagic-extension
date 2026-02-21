import { redefinePropertyValues } from "../helpers/monkey-patch"
import { sanitizeFontFaceSource } from "./css/font-face"
import { isAllowedFont } from "@src/common/font-filter"

const DISALLOWED_FONTS: string[] = [
  // This is android-specific font from "Roboto" family
  'sans-serif-thin',
  'ARNO PRO',
  'Agency FB',
  'Arabic Typesetting',
  'Arial Unicode MS',
  'AvantGarde Bk BT',
  'BankGothic Md BT',
  'Batang',
  'Bitstream Vera Sans Mono',
  'Calibri',
  'Century',
  'Century Gothic',
  'Clarendon',
  'EUROSTILE',
  'Franklin Gothic',
  'Futura Bk BT',
  'Futura Md BT',
  'GOTHAM',
  'Gill Sans',
  'HELV',
  'Haettenschweiler',
  'Helvetica Neue',
  'Humanst521 BT',
  'Leelawadee',
  'Letter Gothic',
  'Levenim MT',
  'Lucida Bright',
  'Lucida Sans',
  'Menlo',
  'MS Mincho',
  'MS Outlook',
  'MS Reference Specialty',
  'MS UI Gothic',
  'MT Extra',
  'MYRIAD PRO',
  'Marlett',
  'Meiryo UI',
  'Microsoft Uighur',
  'Minion Pro',
  'Monotype Corsiva',
  'PMingLiU',
  'Pristina',
  'SCRIPTINA',
  'Segoe UI Light',
  'Serifa',
  'SimHei',
  'Small Fonts',
  'Staccato222 BT',
  'TRAJAN PRO',
  'Univers CE 55 Medium',
  'Vrinda',
  'ZWAdobeF'
].map(fontName => fontName.toLowerCase())

const fonts = (): void => {
  if (!document) {
    return
  }
  const originalFontFace = self.FontFace

  const addEmptyFontFace = (fontFaceSet: FontFaceSet, fontName: string): void => {
    const fontFace = new FontFace(fontName, 'url(data:application/font-woff2;base64,)', {
      style: 'normal',
      weight: '400',
      display: 'swap'
    })
    fontFaceSet.add(fontFace)
  }

  const addEmptyFontFaces = (fontFaceSet: FontFaceSet): void => {
    for (const fontName of DISALLOWED_FONTS) {
      if (isAllowedFont(fontName)) {
        continue
      }
      addEmptyFontFace(fontFaceSet, fontName)
    }
  }

  addEmptyFontFaces(document.fonts)

  Object.defineProperty(self, 'FontFace', {
    value: new Proxy(originalFontFace, {
      construct(target: typeof FontFace, args: [string, string | BufferSource, FontFaceDescriptors | undefined]) {
        const [name, source, descriptors] = args
        const sanitizedSource = typeof source === 'string' ? sanitizeFontFaceSource(source) : source
        return new target(name, sanitizedSource, descriptors)
      }
    }),
    writable: true,
    configurable: true
  })

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const deleteOriginal = document.fonts.delete
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const clearOriginal = document.fonts.clear

  redefinePropertyValues(Object.getPrototypeOf(document.fonts), {
    delete: function (this: FontFaceSet, font: FontFace) {
      deleteOriginal.call(this, font)
      if (DISALLOWED_FONTS.includes(font.family.toLowerCase()) && !isAllowedFont(font.family)) {
        addEmptyFontFace(this, font.family)
      }
    },
    clear: function (this: FontFaceSet) {
      clearOriginal.call(this)
      addEmptyFontFaces(this)
    }
  })
}

export default fonts