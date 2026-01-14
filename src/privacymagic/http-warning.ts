import { handleAsync, logError } from '../common/util'

const urlParam = new URL(window.location.href).searchParams.get('url')
if (urlParam === null || urlParam === '') {
  throw new Error('url parameter is required')
}
const url = urlParam
const domain = new URL(url).hostname

const domainElement = document.getElementById('domain')
if (domainElement === null || domainElement === undefined) {
  throw new Error('domain element not found')
}
domainElement.textContent = domain

const addExceptionElement = document.getElementById('addException')
if (addExceptionElement === null || addExceptionElement === undefined) {
  throw new Error('addException element not found')
}
addExceptionElement.addEventListener('click', (event: Event) => handleAsync(async () => {
  await chrome.runtime.sendMessage({
    type: 'addHttpWarningNetworkRuleException',
    url,
    value: 'exception'
  })
  window.location.replace(url)
}, (error: unknown) => {
  logError(error, 'error adding exception to http warning network rule', { url, event })
}))

const goBackElement = document.getElementById('goBack')
if (goBackElement === null || goBackElement === undefined) {
  throw new Error('goBack element not found')
}
goBackElement.addEventListener('click', () => {
  window.history.back()
})
