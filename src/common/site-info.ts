import punycode from "punycode-npm"

const faviconURL = (pageUrl: string): string => {
  const url = new URL(chrome.runtime.getURL('/_favicon/'))
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', '24')
  return url.toString()
}

export const updateSiteInfo = async (domain: string): Promise<void> => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  const url = tab.url
  const domainElement = document.getElementById('domain')
  if (domainElement === null) {
    throw new Error('domain element not found')
  }
  domainElement.textContent = punycode.toUnicode(domain)
  const favicon = document.getElementById('favicon') as HTMLImageElement | null
  if (favicon != null && url !== undefined && url !== '') {
    favicon.src = faviconURL(url)
  }
}
