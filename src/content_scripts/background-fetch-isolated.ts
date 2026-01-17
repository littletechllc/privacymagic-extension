import { sharedSecret } from "./secret"
import { dispatchEventSafe, documentSafe, CustomEventSafe, FetchID } from "./helpers"

const secret = sharedSecret()

// Send the response back to the main world using a custom event
// whose name is `response_${secret}_${id}`.
const sendFetchResponse = (content: string, id: FetchID) => {
  if (dispatchEventSafe === undefined || documentSafe === undefined || CustomEventSafe === undefined) {
    throw new Error('document not available')
  }
  dispatchEventSafe(
    documentSafe,
    new CustomEventSafe(`response_${secret}_${id}`, { detail: { content } }))
}

// Handle background fetch requests. Fetches the content of the URL and sends
// the response back to the main world.
export const handleBackgroundFetchRequests = (fetchFunction: (url: string) => Promise<string>) => {
  if (secret === undefined) {
    throw new Error('Shared secret is not available')
  }
  document.addEventListener(`fetch_${secret}`, (event) => {
    if (event instanceof CustomEvent) {
      const detail = event.detail as { url: string, id: FetchID }
      void fetchFunction(detail.url).then((content: string) => {
        sendFetchResponse(content, detail.id)
      })
    }
  })
}

