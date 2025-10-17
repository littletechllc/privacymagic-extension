(function () {

const PRIVACYMAGIC_IGNORE = "__privacymagic_ignore"

console.log("Hello from content script", window.location.href, top.location?.href)

const replaceScript = () => {
  const observer = new MutationObserver((records, observer) => {
    //console.log(records)
    for (const record of records) {
      if (record.type === "childList" && record.target && record.target.tagName === 'SCRIPT') {
        if (!record.target.hasAttribute(PRIVACYMAGIC_IGNORE)) {
          record.target.setAttribute(PRIVACYMAGIC_IGNORE, "1")
          record.target.innerText = "console.log('replaced!!!')"
        }
      }
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true })
}

// navigator.globalPrivacyControl
Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
  value: true,
  writable: true,
  enumerable: true,
})

const defineStompableGetter = (obj, prop, get) => {
  let stomped = false;
  let stompValue = undefined
  Object.defineProperty(obj, prop, {
    get: () => stomped ? stompValue : get(),
    set: (val) => {
      stomped = true
      stompValue = val
    }
  })
}

const defineStompableGetters = (arr) => {
  for (const [obj, prop, get] of arr) {
    defineStompableGetter(obj, prop, get)
  }
}

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
      return {width, height}
    }
  }
  return allowedScreenSizes[allowedScreenSizes.length - 1]
}

const [spoofedScreenWidth, spoofedScreenHeight] = spoofScreenSize();

// screen size
defineStompableGetters([
  [window, 'screenX', () => 0],
  [window, 'screenY', () => 0],
  [window, 'screenLeft', () => 0],
  [window, 'screenTop', () => 0],
  [window, 'outerWidth', () => window.innerWidth],
  [window, 'outerHeight', () => window.innerHeight],
  [Screen.prototype, 'width', () => spoofedScreenWidth],
  [Screen.prototype, 'height', () => spoofedScreenHeight],
  [Screen.prototype, 'availLeft', () => 0],
  [Screen.prototype, 'availTop', () => 0],
  [Screen.prototype, 'availWidth', () => spoofedScreenWidth],
  [Screen.prototype, 'availHeight', () => spoofedScreenHeight],
  [window, 'matchMedia', () => ((mediaQueryString) =>
    oldMatchMedia(mediaDeviceToViewport(mediaQueryString)
  ))]
])

// window.name
// TODO: hide item from page by modifying sessionStorage behavior
const NAME_IN_SESSIONSTORAGE = "__privacymagic_name"
if (window.opener && window.name !== '') {
  sessionStorage.setItem(NAME_IN_SESSIONSTORAGE, window.name)
  window.name = ''
}
Object.defineProperty(window, "name", {
  get: () => (sessionStorage.getItem(NAME_IN_SESSIONSTORAGE) || ''),
  set: (s) => sessionStorage.setItem(NAME_IN_SESSIONSTORAGE, s)
})

// window.fetch
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

})()
