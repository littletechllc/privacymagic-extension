import { MapSafe, SetSafe, mapDeleteSafe, mapGetSafe, mapSetSafe, setAddSafe, setDeleteSafe, setHasSafe } from "@src/content_scripts/helpers/safe"
import type { GlobalScope } from "@src/content_scripts/helpers/globalObject"

let isInitialized = false
let lockObjectUrl: (url: string) => void
let unlockObjectUrl: (url: string) => void
let getCachedBlob: (url: string) => Blob | undefined

export const enableBlobLockingAndCaching = (globalObject: GlobalScope): { lockObjectUrl: (url: string) => void, unlockObjectUrl: (url: string) => void, getCachedBlob: (url: string) => Blob | undefined } => {
  if (isInitialized) {
    return { lockObjectUrl, unlockObjectUrl, getCachedBlob }
  }
  isInitialized = true
  const originalRevokeObjectURL = globalObject.URL.revokeObjectURL.bind(globalObject.URL)

  const pendingRevocations = new SetSafe<string>()
  const lockedUrls = new MapSafe<string, number>()
  const blobURLCache = new MapSafe<string, Blob>()

  const isLockedObjectUrl = (url: string): boolean => {
    return (lockedUrls.get(url) ?? 0) > 0
  }

  const requestToRevokeObjectUrl = (url: string): void => {
    if (!isLockedObjectUrl(url)) {
      originalRevokeObjectURL(url)
      mapDeleteSafe(blobURLCache, url)
    } else {
      setAddSafe(pendingRevocations, url)
    }
  }

  unlockObjectUrl = (url: string): void => {
    if (!isLockedObjectUrl(url)) {
      return
    }
    const lockCount = lockedUrls.get(url) ?? 0
    if (lockCount <= 1) {
      lockedUrls.delete(url)
      if (setHasSafe(pendingRevocations, url)) {
        originalRevokeObjectURL(url)
        setDeleteSafe(pendingRevocations, url)
        mapDeleteSafe(blobURLCache, url)
      }
    } else {
      lockedUrls.set(url, lockCount - 1)
    }
  }

  lockObjectUrl = (url: string): void => {
    const lockCount = lockedUrls.get(url) ?? 0
    lockedUrls.set(url, lockCount + 1)
  }

  const BlobSafe = globalObject.Blob

  const originalCreateObjectURL = globalObject.URL.createObjectURL.bind(globalObject.URL)
  globalObject.URL.createObjectURL = (source: Blob | MediaSource): string => {
    const url = originalCreateObjectURL(source)
    if (source instanceof BlobSafe) {
      mapSetSafe(blobURLCache, url, source)
    }
    return url
  }

  globalObject.URL.revokeObjectURL = (url: string) => {
    requestToRevokeObjectUrl(url)
  }

  getCachedBlob = (url: string): Blob | undefined => {
    return mapGetSafe(blobURLCache, url)
  }

  return { lockObjectUrl, unlockObjectUrl, getCachedBlob }
}