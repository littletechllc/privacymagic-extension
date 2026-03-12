//import { createSafeMethod } from "./helpers/monkey-patch"

const waitForVideoPlayerElement = (): Promise<HTMLDivElement> => {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const player = document.getElementsByClassName('html5-video-player')[0] as HTMLDivElement | null
      if (player != null) {
        clearInterval(interval)
        resolve(player)
      }
    }, 30)
  })
}


const skipVideoIfAd = (player: HTMLDivElement): void => {
  const video = player.querySelector('video')
  if (video == null) return
  if (player.classList.contains('ad-interrupting') || player.classList.contains('ad-showing')) {
    console.log('ad detected:', performance.now(), video.duration, video.src)
    if (isNaN(video.duration)) {
      console.log(player)
      return
    }
    if (!isNaN(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.15) {
      video.muted = true
      video.currentTime = Math.max(0, video.duration - 0.1)
      const adSkipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');

      if (adSkipBtn != null) {
        (adSkipBtn as HTMLElement).click();
      }
    }
  }
}

/*

const modifyEventListeners = (): void => {
  const originalAddEventListener = createSafeMethod(EventTarget, 'addEventListener')
  Object.defineProperty(EventTarget.prototype, 'addEventListener', {
    value: function (this: EventTarget, type: string, listener: EventListener, options: boolean | AddEventListenerOptions) {
      console.log('maybe adding event listener:', type)
      originalAddEventListener(this, type, listener, options)
    }
  })
}

const interceptClassListChanges = (callback: () => void): void => {
  const originalAdd = createSafeMethod(DOMTokenList, 'add')
  Object.defineProperty(DOMTokenList.prototype, 'add', {
    value: function (this: DOMTokenList, value: string) {
      if (value === 'ad-showing' || value === 'ad-interrupting') {
        console.log('detected ad class:', value)
        callback()
        return
      }
      return originalAdd(this, value)
    }
  })
}

const modifyFetch = (): void => {
  const originalFetch = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch(input, init)
    const data = await response.json() as Record<string, unknown>;

    if (data.playerResponse) {
      const pr = data.playerResponse as Record<string, unknown>;

      // 1. Kill the ad schedule
      if (pr.adPlacements) {
        console.log("Blocking ad schedule...");
        delete pr.adPlacements;
      }

      // 2. Kill the ad UI config
      if (pr.playerAds) {
        console.log("Blocking ad UI...");
        delete pr.playerAds;
      }

      // 3. Clean up the "Playability Status"
      // Sometimes YouTube marks a video as 'UNPLAYABLE' if ads fail.
      // We force it back to 'OK'.
     // if (pr.playabilityStatus && pr.playabilityStatus.status !== "OK") {
     //   pr.playabilityStatus.status = "OK";
     // }
    }
    return new Response(JSON.stringify(data), { ...response });
  }
}

const sanitizeBuiltIn = () => {
  const ytInitialPlayerResponse = window.ytInitialPlayerResponse as Record<string, unknown>;
  if (ytInitialPlayerResponse) {
    ytInitialPlayerResponse.adPlacements = [];
    ytInitialPlayerResponse.playerAds = [];
    console.log("Sanitized Initial Player Response");
  } else {
    requestAnimationFrame(() => {
      sanitizeBuiltIn()
    })
  }
}
*/

const main = async (): Promise<void> => {
 // modifyEventListeners()
  const player = await waitForVideoPlayerElement()
  console.log('player:', player)
  //interceptClassListChanges(() => {
    skipVideoIfAd(player)
  //})
  //modifyFetch()
  //sanitizeBuiltIn()
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
       // console.log('mutation:', mutation, (mutation.target as Element).classList)
        const target = mutation.target
        if (!(target instanceof Element)) return
        skipVideoIfAd(target as HTMLDivElement)
      }
    })
  })
  observer.observe(player, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class']
  })
}

void main()
