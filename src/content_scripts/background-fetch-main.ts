import { sharedSecret } from "./secret"
import { dispatchEventSafe, documentSafe, CustomEventSafe, FetchID } from "./helpers"

const secret = sharedSecret()

// Send a request to the isolated world to fetch the content of the URL.
// The request is sent using a custom event whose name is `fetch_${secret}`,
// with an associated id.
const sendBackgroundFetchRequest = (url: string, id: FetchID): void => {
  if (dispatchEventSafe === undefined || documentSafe === undefined || CustomEventSafe === undefined) {
    throw new Error('document not available')
  }
  dispatchEventSafe(
    documentSafe,
    new CustomEventSafe(`fetch_${secret}`,
      { detail: { url, id } }))
}

// Send a request to the isolated world and wait for the response in a custom
// event whose name is `response_${secret}_${id}`. Returns a promise that
// resolves to the content of the fetched URL.
export const backgroundFetch: (url: string) => Promise<string> = async (url: string) => {
  if (secret === undefined) {
    throw new Error('Shared secret is not available')
  }
  const id: FetchID = crypto.randomUUID()
  const contentPromise = new Promise<string>((resolve) => {
    document.addEventListener(`response_${secret}_${id}`, (event) => {
      if (event instanceof CustomEvent) {
        const detail = event.detail as { content: string }
        resolve(detail.content)
      }
    }, { once: true })
  })
  sendBackgroundFetchRequest(url, id)
  return contentPromise
}