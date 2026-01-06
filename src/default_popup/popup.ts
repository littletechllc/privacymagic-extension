import { setupSettingsUI } from '../common/settings-ui'
import { handleAsync, logError } from '../common/util'
import punycode from 'punycode-npm'

const setupOptionsButton = (): void => {
  document.getElementById('optionsButton')?.addEventListener('click', (event) => {
    try {
      console.log('optionsButton clicked')
      void chrome.runtime.openOptionsPage()
    } catch (error) {
      logError(error, 'error opening options page', event)
    }
  })
}

const faviconURL = (pageUrl: string): string => {
  const url = new URL(chrome.runtime.getURL('/_favicon/'))
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', '24')
  return url.toString()
}

const updateSiteInfo = async (domain: string): Promise<void> => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  const url = tab.url
  const domainElement = document.getElementById('domain')
  if (domainElement === null) {
    throw new Error('domain element not found')
  }
  domainElement.textContent = punycode.toUnicode(domain)
  const favicon = document.getElementById('favicon') as HTMLImageElement | null
  if ((favicon != null) && url !== undefined && url !== '') {
    favicon.src = faviconURL(url)
  }
}

document.addEventListener('DOMContentLoaded', (event) => handleAsync(async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'getDomainForCurrentTab'
  })
  if (response === undefined || typeof response !== 'object' || !('success' in response) || response.success !== true) {
    return
  }
  const domain = response.domain
  setupOptionsButton()
  await updateSiteInfo(domain)
  await setupSettingsUI(domain)
}, (error: unknown) => {
  logError(error, 'error responding to DOMContentLoaded on current tab', event)
}))
