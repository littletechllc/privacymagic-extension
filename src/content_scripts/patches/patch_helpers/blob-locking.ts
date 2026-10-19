import { MapSafe, SetSafe, mapDeleteSafe, mapGetSafe, mapSetSafe, setAddSafe, setDeleteSafe, setHasSafe } from "@src/content_scripts/helpers/safe"
import type { GlobalScope } from "@src/content_scripts/helpers/globalObject"

export type BlobLocking = {
  lockObjectUrl: (url: string) => void
  unlockObjectUrl: (url: string) => void
  getCachedBlob: (url: string) => Blob | undefined
}

let blobLocking: BlobLocking | undefined

export const enableBlobLockingAndCaching = (globalObject: GlobalScope): BlobLocking => {
  if (blobLocking) {
    return blobLocking
  }
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

  const unlockObjectUrl = (url: string): void => {
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

  const lockObjectUrl = (url: string): void => {
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

  const getCachedBlob = (url: string): Blob | undefined => {
    return mapGetSafe(blobURLCache, url)
  }

  blobLocking = {
    lockObjectUrl,
    unlockObjectUrl,
    getCachedBlob,
  }
  return blobLocking
}

/** Reset singleton state so tests can patch a fresh `URL` object. */
export const resetBlobLockingAndCachingForTests = (): void => {
  blobLocking = undefined
}