(function () {

const PRIVACYMAGIC_IGNORE = "__privacymagic_ignore"

//console.log("Hello from content script", window.location.href, top.location?.href)

const redefinePropertyValues = (obj, propertyMap) => {
  let properties = {}
  for (const [prop, value] of Object.entries(propertyMap)) {
    properties[prop] = { value, writable: true, enumerable: true }
  }
  Object.defineProperties(obj, properties)
}
console.log("redefinePropertyValues", redefinePropertyValues, typeof redefinePropertyValues)

const oldMatchMedia = window.matchMedia

const mediaDeviceToViewport = (mediaQueryString) =>
  mediaQueryString
    ?.replaceAll('device-width', 'width')
    ?.replaceAll('device-height', 'height')

const allowedScreenSizes = [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160]
]

const spoofScreenSize = (minWidth, minHeight) => {
  for (const [width, height] of allowedScreenSizes) {
    if (width >= minWidth && height >= minHeight) {
      return [width, height]
    }
  }
  return allowedScreenSizes[allowedScreenSizes.length - 1]
}

const [spoofedScreenWidth, spoofedScreenHeight] = spoofScreenSize(innerWidth, innerHeight);

console.log("41: redefinePropertyValues", redefinePropertyValues, typeof redefinePropertyValues)
redefinePropertyValues(Navigator.prototype, {
  cookieEnabled: true,
  cpuClass: undefined,
  deviceMemory: 1,
//  doNotTrack: '1',
  globalPrivacyControl: true,
  hardwareConcurrency: 4,
//  languages: [navigator.language],
  maxTouchPoints: 1,
  onLine: true,
  oscpu: undefined,
  pdfViewerEnabled: true,
  platform: 'Windows',
  productSub: '20030107',
  vendor: 'Google Inc.',
 // vendorSub: ''
});
redefinePropertyValues(Screen.prototype, {
  availHeight: spoofedScreenHeight,
  availLeft: 0,
  availTop: 0,
  availWidth: spoofedScreenWidth,
  colorDepth: 24,
  height: spoofedScreenHeight,
  pixelDepth: 24,
  width: spoofedScreenWidth
});
redefinePropertyValues(window, {
  devicePixelRatio: 1,
  matchMedia: (mediaQueryString) => oldMatchMedia(mediaDeviceToViewport(mediaQueryString)),
  outerHeight: window.innerHeight,
  outerWidth: window.innerWidth,
  screenLeft: 0,
  screenTop: 0,
  screenX: 0,
  screenY: 0
});

// window.fetch
/*
const BLOBS_IN_LOCALSTORAGE = "__privacymagic_blobs"
const getBlobUrisInLocalStorage = () =>
  JSON.parse(localStorage.getItem(BLOBS_IN_LOCALSTORAGE) || '[]')
const setBlobUrisInLocalStorage = (blobs) =>
  localStorage.setItem(BLOBS_IN_LOCALSTORAGE, JSON.stringify(blobs))
const addBlobUriToLocalStorage = (blobUri) => {
  const blobUris = getBlobUrisInLocalStorage()
  blobUris.push(blobUri)
  setBlobUrisInLocalStorage(blobUris)
}
const isBlobUriInLocalStorage = (blobUri) => {
  const blobUris = getBlobUrisInLocalStorage()
  return blobUris.includes(blobUri)
}
const oldFetch = window.fetch
let stomped = false
let stompedValue    
defineStompableGetter(window, "fetch", (resource, ...args) => {
//        document.body.style.backgroundColor = 'green'
        console.log('===========================================', resource)
        const uri = resource?.toString()?.trim()
        console.log('=======================================', uri)
        if (uri && uri?.startsWith("blob:") && !isBlobUriInLocalStorage(uri)) {
          throw new TypeError("Failed to fetch")
        }
        return oldFetch(resource, ...args)
      })

// URL.createObjectURL
const oldCreateObjectURL = URL.createObjectURL
Object.defineProperty(URL, "createObjectURL", {
  get: () => {
    return ((obj) => {
      const blobUri = oldCreateObjectURL(obj)
      addBlobUriToLocalStorage(blobUri)
      return blobUri
    })
  }
})
*/
})()
