import punycode from 'punycode'
import { browserInfo } from '@src/common/browser'

const faviconURL = (pageUrl: string): string => {
  const url = new URL(chrome.runtime.getURL('/_favicon/'))
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', '24')
  return url.toString()
}

export const updateSiteInfo = (domain: string, pageUrl: string): void => {
  const domainElement = document.getElementById('domain')
  if (domainElement === null) {
    throw new Error('domain element not found')
  }
  domainElement.textContent = punycode.toUnicode(domain)
  const favicon = document.getElementById('favicon') as HTMLImageElement | null
  if (favicon == null) {
    return
  }
  // Chromium's _favicon/ serves from the browser cache. Safari/Firefox have no
  // equivalent; loading tab.favIconUrl would trigger a new request.
  if (!browserInfo.isChromium || pageUrl === '') {
    favicon.hidden = true
    return
  }
  favicon.hidden = false
  favicon.src = faviconURL(pageUrl)
}
