import { sharedSecret } from "./secret"
import { createSafeMethod } from "./helpers"

const secret = sharedSecret()
const dispatchEventSafe = createSafeMethod(Document, 'dispatchEvent')
const documentSafe = document;
const CustomEventSafe = CustomEvent

type FetchID = string

// Send a request to the isolated world to fetch the content of the URL.
// The request is sent using a custom event whose name is `fetch_${secret}`,
// with an associated id.
const sendBackgroundFetchRequest = (url: string, id: FetchID): void => {
  dispatchEventSafe(
    documentSafe,
    new CustomEventSafe(`fetch_${secret}`,
      { detail: { url, id } }))
}

// This function is used to send the response back to the main world using a custom event
// whose name is `response_${secret}_${id}`.
const sendFetchResponse = (content: string, id: FetchID) => {
  dispatchEventSafe(
    documentSafe,
    new CustomEventSafe(`response_${secret}_${id}`, { detail: { content } }))
}

// This function is used to handle background fetch requests.
// It is used to fetch the content of the URL and send the response back to the main world.
export const handleBackgroundFetchRequests = (fetchFunction: (url: string) => Promise<string>) => {
  document.addEventListener(`fetch_${secret}`, (event) => {
    if (event instanceof CustomEvent) {
      const detail = event.detail as { url: string, id: FetchID }
      void fetchFunction(detail.url).then((content: string) => {
        sendFetchResponse(content, detail.id)
      })
    }
  })
}

// This function returns a promise that resolves to the content of the fetched URL.
// Under the hood, it sends a request to the isolated world and waits for the response
// using a custom event whose name is `response_${secret}_${id}`.
export const backgroundFetch: (url: string) => Promise<string> = async (url: string) => {
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