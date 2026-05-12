export const fetchLocalFile = async (path: string): Promise<string> => {
  const url = chrome.runtime.getURL(path)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch local file: ${path}: ${response.statusText}`)
  }
  return await response.text()
}

const indexFileCache = new Map<string, Promise<Set<string>>>()

export const readIndexFile = async (dir: string): Promise<Set<string>> => {
  if (!indexFileCache.has(dir)) {
    indexFileCache.set(dir, fetchLocalFile(`${dir}/index.txt`).then(indexFile => {
      const domains = indexFile.split('\n')
      return new Set(domains.map(domain => domain.trim()).filter(domain => domain !== ''))
    }))
  }
  return await indexFileCache.get(dir)!
}
